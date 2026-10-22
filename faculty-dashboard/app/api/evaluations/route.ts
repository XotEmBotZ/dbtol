import { NextRequest, NextResponse } from "next/server";
import { getEvaluations, addEvaluationRecord } from "@/lib/student-storage";
import type { StudentEvaluationRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const regNo = searchParams.get("regNo");
  const id = searchParams.get("id");

  const evaluations = getEvaluations();

  if (id) {
    const item = evaluations.find((e) => e.id === id);
    if (!item) {
      return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, evaluation: item });
  }

  let filtered = evaluations;
  if (studentId) {
    filtered = filtered.filter((e) => e.studentId === studentId);
  } else if (regNo) {
    filtered = filtered.filter(
      (e) => e.studentRegNo.toUpperCase() === regNo.toUpperCase()
    );
  }

  return NextResponse.json({ success: true, evaluations: filtered });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { evaluation, batchEvaluations } = body;

    if (Array.isArray(batchEvaluations)) {
      const saved: StudentEvaluationRecord[] = [];
      for (const ev of batchEvaluations) {
        const created = addEvaluationRecord(ev);
        saved.push(created);
      }
      return NextResponse.json({ success: true, count: saved.length, evaluations: saved });
    }

    if (evaluation) {
      const created = addEvaluationRecord(evaluation);
      return NextResponse.json({ success: true, evaluation: created });
    }

    return NextResponse.json({ success: false, error: "Missing evaluation payload" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
