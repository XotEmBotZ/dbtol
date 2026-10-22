import fs from "fs";
import path from "path";
import type { StudentRecord, StudentEvaluationRecord } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");
const EVALUATIONS_FILE = path.join(DATA_DIR, "evaluations.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getStudents(): StudentRecord[] {
  ensureDirectory();
  if (!fs.existsSync(STUDENTS_FILE)) {
    const initial: StudentRecord[] = [
      {
        id: "stu-1",
        regNo: "21BCE1001",
        name: "Arun Kumar",
        email: "arun.kumar@vitstudent.ac.in",
        targetNodeId: "node-10-0-1-101",
        targetIp: "10.0.1.101",
        targetPort: 1521,
        notes: "Lab Seat A1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "stu-2",
        regNo: "21BCE1002",
        name: "Bhavna Patel",
        email: "bhavna.patel@vitstudent.ac.in",
        targetNodeId: "node-10-0-1-102",
        targetIp: "10.0.1.102",
        targetPort: 1521,
        notes: "Lab Seat A2",
        createdAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(STUDENTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStudents(students: StudentRecord[]) {
  ensureDirectory();
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(students, null, 2), "utf-8");
}

export function getEvaluations(): StudentEvaluationRecord[] {
  ensureDirectory();
  if (!fs.existsSync(EVALUATIONS_FILE)) {
    fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  }
  try {
    const raw = fs.readFileSync(EVALUATIONS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEvaluations(records: StudentEvaluationRecord[]) {
  ensureDirectory();
  fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(records, null, 2), "utf-8");
}

export function addEvaluationRecord(rec: Omit<StudentEvaluationRecord, "id">): StudentEvaluationRecord {
  const records = getEvaluations();
  const newRec: StudentEvaluationRecord = {
    ...rec,
    id: `eval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
  records.unshift(newRec);
  saveEvaluations(records);
  return newRec;
}
