"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users,
  UserPlus,
  Upload,
  Edit2,
  Trash2,
  Save,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Search,
  Server,
} from "lucide-react";
import type { StudentRecord, DiscoveredNode } from "@/lib/types";

interface StudentsManagerProps {
  nodes?: DiscoveredNode[];
  onSelectStudentForEval?: (student: StudentRecord) => void;
}

export function StudentsManager({ nodes = [], onSelectStudentForEval }: StudentsManagerProps) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Edit / Create modal/drawer state
  const [editingStudent, setEditingStudent] = useState<Partial<StudentRecord> | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Bulk CSV upload state
  const [csvText, setCsvText] = useState("");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudentsList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (data.success && data.students) {
        setStudents(data.students);
      }
    } catch {
      setStatusMsg({ text: "Failed to load students", ok: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentsList();
  }, []);

  const handleSaveStudent = async () => {
    if (!editingStudent?.regNo || !editingStudent?.name) {
      setStatusMsg({ text: "Registration Number and Name are required", ok: false });
      return;
    }

    try {
      const action = isNew ? "create" : "update";
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, student: editingStudent }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          text: `Student ${editingStudent.regNo} saved successfully`,
          ok: true,
        });
        setEditingStudent(null);
        fetchStudentsList();
      } else {
        setStatusMsg({ text: data.error || "Save failed", ok: false });
      }
    } catch {
      setStatusMsg({ text: "Network error saving student", ok: false });
    }
  };

  const handleDelete = async (id: string, regNo: string) => {
    if (!confirm(`Are you sure you want to delete student ${regNo}?`)) return;
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", student: { id } }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `Student ${regNo} removed`, ok: true });
        fetchStudentsList();
      } else {
        setStatusMsg({ text: data.error || "Delete failed", ok: false });
      }
    } catch {
      setStatusMsg({ text: "Network error deleting student", ok: false });
    }
  };

  const handleCsvUpload = async () => {
    const lines = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setStatusMsg({ text: "CSV content is empty", ok: false });
      return;
    }

    // Header check (if line 1 has regNo / RegNo)
    let startIndex = 0;
    if (lines[0].toLowerCase().includes("reg")) {
      startIndex = 1;
    }

    const batchStudents: Partial<StudentRecord>[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        batchStudents.push({
          regNo: parts[0],
          name: parts[1],
          email: parts[2] || undefined,
          targetIp: parts[3] || undefined,
          targetPort: parts[4] ? parseInt(parts[4], 10) : 1521,
          notes: parts[5] || undefined,
        });
      }
    }

    if (batchStudents.length === 0) {
      setStatusMsg({ text: "No valid rows found in CSV", ok: false });
      return;
    }

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_upload", students: batchStudents }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          text: `Successfully imported / synced ${data.count} students!`,
          ok: true,
        });
        setShowCsvModal(false);
        setCsvText("");
        fetchStudentsList();
      } else {
        setStatusMsg({ text: data.error || "Upload failed", ok: false });
      }
    } catch {
      setStatusMsg({ text: "Network error during batch upload", ok: false });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  const filtered = students.filter(
    (s) =>
      s.regNo.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.targetIp && s.targetIp.includes(search))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-neutral-800" />
            <h1 className="text-xl font-bold font-mono text-neutral-900 tracking-tight">
              STUDENT DIRECTORY & NODE MAPPING
            </h1>
          </div>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            Manage student registrations, seat assignments, and mapped swarm Oracle DB instances.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingStudent({ regNo: "", name: "", email: "", targetPort: 1521 });
              setIsNew(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-mono font-bold hover:bg-neutral-800 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            NEW STUDENT
          </button>

          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-mono font-bold hover:bg-neutral-200 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            UPLOAD CSV
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 text-xs font-mono flex items-center justify-between border ${
            statusMsg.ok
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by Reg No, Name, or Target IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-neutral-300 bg-white focus:outline-none focus:border-black"
          />
        </div>
        <div className="text-xs font-mono text-neutral-500">
          Showing {filtered.length} of {students.length} students
        </div>
      </div>

      {/* Table */}
      <div className="border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 uppercase text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Reg No</th>
                <th className="py-2.5 px-3 font-semibold">Student Name</th>
                <th className="py-2.5 px-3 font-semibold">Email</th>
                <th className="py-2.5 px-3 font-semibold">Assigned DB Node</th>
                <th className="py-2.5 px-3 font-semibold">Notes / Seat</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400">
                    {loading ? "Loading student records..." : "No student records found."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-bold text-neutral-900">{s.regNo}</td>
                    <td className="py-2.5 px-3 text-neutral-800">{s.name}</td>
                    <td className="py-2.5 px-3 text-neutral-500">{s.email || "—"}</td>
                    <td className="py-2.5 px-3">
                      {s.targetIp ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-neutral-100 px-2 py-0.5 border border-neutral-200 text-neutral-700">
                          <Server className="w-3 h-3 text-neutral-500" />
                          {s.targetIp}:{s.targetPort || 1521}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500">{s.notes || "—"}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onSelectStudentForEval && (
                          <button
                            onClick={() => onSelectStudentForEval(s)}
                            className="px-2 py-0.5 text-[10px] bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                            title="Quick Evaluate this student"
                          >
                            EVALUATE
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingStudent(s);
                            setIsNew(false);
                          }}
                          className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-100"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.regNo)}
                          className="p-1 text-neutral-400 hover:text-red-600 hover:bg-neutral-100"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-400 shadow-xl max-w-lg w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <h3 className="font-bold text-sm text-neutral-900">
                {isNew ? "ADD NEW STUDENT" : `EDIT STUDENT: ${editingStudent.regNo}`}
              </h3>
              <button onClick={() => setEditingStudent(null)} className="text-neutral-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  value={editingStudent.regNo || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, regNo: e.target.value })}
                  placeholder="e.g. 21BCE1001"
                  className="w-full p-2 border border-neutral-300 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  value={editingStudent.name || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  placeholder="Full Name"
                  className="w-full p-2 border border-neutral-300 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editingStudent.email || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  placeholder="student@university.edu"
                  className="w-full p-2 border border-neutral-300 focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Target IP / Host
                  </label>
                  <input
                    type="text"
                    value={editingStudent.targetIp || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, targetIp: e.target.value })}
                    placeholder="10.0.1.X or 127.0.0.1"
                    className="w-full p-2 border border-neutral-300 focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={editingStudent.targetPort || 1521}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, targetPort: parseInt(e.target.value, 10) })
                    }
                    className="w-full p-2 border border-neutral-300 focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Swarm Quick Bind dropdown */}
              {nodes.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Or Select Discovered Swarm Node:
                  </label>
                  <select
                    className="w-full p-2 border border-neutral-300 bg-white"
                    onChange={(e) => {
                      const sel = nodes.find((n) => n.id === e.target.value);
                      if (sel) {
                        setEditingStudent({
                          ...editingStudent,
                          targetNodeId: sel.id,
                          targetIp: sel.dbIp || sel.ip,
                          targetPort: sel.dbPort || 1521,
                        });
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">-- Choose node to bind --</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.hostname} ({n.dbIp || n.ip}:{n.dbPort || 1521})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Lab Seat / Notes
                </label>
                <input
                  type="text"
                  value={editingStudent.notes || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, notes: e.target.value })}
                  placeholder="e.g. Lab 2, PC #14"
                  className="w-full p-2 border border-neutral-300 focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
              <button
                onClick={() => setEditingStudent(null)}
                className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStudent}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white font-bold hover:bg-neutral-800"
              >
                <Save className="w-3.5 h-3.5" />
                Save Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Batch Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-400 shadow-xl max-w-xl w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-neutral-800" />
                <h3 className="font-bold text-sm text-neutral-900">BULK IMPORT STUDENTS (CSV)</h3>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-neutral-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-neutral-600 text-[11px]">
                Paste CSV content below or select a <code>.csv</code> file. Format:
                <br />
                <span className="font-bold bg-neutral-100 px-1 py-0.5">
                  RegNo, Name, Email, TargetIP, Port, SeatNotes
                </span>
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 bg-neutral-100 border border-neutral-300 text-neutral-700 hover:bg-neutral-200"
                >
                  Choose File...
                </button>
                <span className="text-[11px] text-neutral-400">or paste text directly</span>
              </div>

              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`21BCE1001, John Doe, john@vit.ac.in, 10.0.1.101, 1521, Lab PC-01\n21BCE1002, Jane Smith, jane@vit.ac.in, 10.0.1.102, 1521, Lab PC-02`}
                className="w-full p-2 border border-neutral-300 font-mono text-xs focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCsvUpload}
                disabled={!csvText.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white font-bold hover:bg-neutral-800 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
