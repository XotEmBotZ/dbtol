import { NextRequest, NextResponse } from "next/server";
import { getStudents, saveStudents } from "@/lib/student-storage";
import type { StudentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const students = getStudents();
  return NextResponse.json({ success: true, students });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, student, students: batchStudents } = body;

    let students = getStudents();

    if (action === "create" && student) {
      const newStudent: StudentRecord = {
        id: `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        regNo: String(student.regNo || "").trim().toUpperCase(),
        name: String(student.name || "").trim(),
        email: student.email ? String(student.email).trim() : undefined,
        targetNodeId: student.targetNodeId || undefined,
        targetIp: student.targetIp || undefined,
        targetPort: student.targetPort ? Number(student.targetPort) : undefined,
        notes: student.notes || undefined,
        createdAt: new Date().toISOString(),
      };
      if (!newStudent.regNo || !newStudent.name) {
        return NextResponse.json({ success: false, error: "Reg No and Name are required" }, { status: 400 });
      }
      students.push(newStudent);
      saveStudents(students);
      return NextResponse.json({ success: true, student: newStudent });
    }

    if (action === "update" && student && student.id) {
      const idx = students.findIndex((s) => s.id === student.id);
      if (idx === -1) {
        return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
      }
      students[idx] = {
        ...students[idx],
        ...student,
        regNo: student.regNo ? String(student.regNo).trim().toUpperCase() : students[idx].regNo,
        name: student.name ? String(student.name).trim() : students[idx].name,
        updatedAt: new Date().toISOString(),
      };
      saveStudents(students);
      return NextResponse.json({ success: true, student: students[idx] });
    }

    if (action === "delete" && student && student.id) {
      students = students.filter((s) => s.id !== student.id);
      saveStudents(students);
      return NextResponse.json({ success: true });
    }

    if (action === "batch_upload" && Array.isArray(batchStudents)) {
      const added: StudentRecord[] = [];
      for (const item of batchStudents) {
        if (!item.regNo || !item.name) continue;
        const reg = String(item.regNo).trim().toUpperCase();
        const existingIdx = students.findIndex((s) => s.regNo === reg);
        if (existingIdx >= 0) {
          students[existingIdx] = {
            ...students[existingIdx],
            ...item,
            regNo: reg,
            updatedAt: new Date().toISOString(),
          };
          added.push(students[existingIdx]);
        } else {
          const rec: StudentRecord = {
            id: `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            regNo: reg,
            name: String(item.name).trim(),
            email: item.email ? String(item.email).trim() : undefined,
            targetNodeId: item.targetNodeId || undefined,
            targetIp: item.targetIp || undefined,
            targetPort: item.targetPort ? Number(item.targetPort) : undefined,
            notes: item.notes || undefined,
            createdAt: new Date().toISOString(),
          };
          students.push(rec);
          added.push(rec);
        }
      }
      saveStudents(students);
      return NextResponse.json({ success: true, count: added.length });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
