"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Filter,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import type { StudentEvaluationRecord } from "@/lib/types";

interface EvaluationHistoryProps {
  initialEvaluationId?: string;
  onBackToEvaluation?: () => void;
}

export function EvaluationHistory({
  initialEvaluationId,
  onBackToEvaluation,
}: EvaluationHistoryProps) {
  const [records, setRecords] = useState<StudentEvaluationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRecord, setSelectedRecord] = useState<StudentEvaluationRecord | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evaluations");
      const data = await res.json();
      if (data.success && data.evaluations) {
        setRecords(data.evaluations);
        if (initialEvaluationId) {
          const matched = data.evaluations.find(
            (e: StudentEvaluationRecord) => e.id === initialEvaluationId
          );
          if (matched) setSelectedRecord(matched);
        }
      }
    } catch {
      console.error("Failed to load evaluation history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [initialEvaluationId]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: prev[cat] === undefined ? false : !prev[cat],
    }));
  };

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.studentRegNo.toLowerCase().includes(search.toLowerCase()) ||
      r.studentName.toLowerCase().includes(search.toLowerCase()) ||
      r.benchmarkName.toLowerCase().includes(search.toLowerCase()) ||
      r.hostname.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ? true : r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-neutral-800" />
            <h1 className="text-xl font-bold font-mono text-neutral-900 tracking-tight">
              STUDENT EVALUATION DETAILED VIEW & RECORDS
            </h1>
          </div>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            Historical evaluation scores, granular benchmark breakdown, and audit trails.
          </p>
        </div>

        {onBackToEvaluation && (
          <button
            onClick={onBackToEvaluation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-mono font-bold hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO EVALUATION RUNNER
          </button>
        )}
      </div>

      {/* Main split view: list and detailed view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Records list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter by RegNo, Name, Benchmark..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-neutral-300 bg-white focus:outline-none focus:border-black"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-2 text-xs font-mono border border-neutral-300 bg-white focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="PASSED">Passed</option>
              <option value="PARTIAL">Partial</option>
              <option value="FAILED">Failed</option>
              <option value="ERROR">Error</option>
            </select>
          </div>

          <div className="border border-neutral-200 bg-white divide-y divide-neutral-200 max-h-[650px] overflow-y-auto shadow-sm">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-neutral-400">
                {loading ? "Loading records..." : "No evaluation records found."}
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = selectedRecord?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecord(r)}
                    className={`p-3 cursor-pointer transition text-xs font-mono border-l-4 ${
                      isSelected
                        ? "bg-neutral-100 border-black"
                        : "border-transparent hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <span>{r.studentRegNo}</span>
                          <span className="text-neutral-500 font-normal">
                            ({r.studentName})
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {r.benchmarkName} • {r.hostname}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-bold ${
                            r.status === "PASSED"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {r.scorePercentage.toFixed(1)}%
                        </span>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          {r.earnedPoints}/{r.totalPoints} pts
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-2">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(r.evaluatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed View */}
        <div className="lg:col-span-7">
          {selectedRecord ? (
            <div className="border border-neutral-200 bg-white p-5 space-y-5 shadow-sm font-mono text-xs">
              {/* Header card */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-200">
                <div>
                  <div className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    <span>{selectedRecord.studentRegNo} - {selectedRecord.studentName}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    Benchmark: <span className="font-semibold text-neutral-800">{selectedRecord.benchmarkName}</span>
                    {" • "}Target Node: <span className="text-neutral-800">{selectedRecord.hostname} ({selectedRecord.targetIp}:{selectedRecord.targetPort})</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1">
                    Evaluated on {new Date(selectedRecord.evaluatedAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-2xl font-black ${
                      selectedRecord.status === "PASSED"
                        ? "text-emerald-600"
                        : selectedRecord.status === "PARTIAL"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {selectedRecord.scorePercentage.toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-bold text-neutral-600">
                    {selectedRecord.earnedPoints} / {selectedRecord.totalPoints} POINTS
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 mt-1 text-[10px] font-bold uppercase ${
                      selectedRecord.status === "PASSED"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedRecord.status === "PARTIAL"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedRecord.status}
                  </span>
                </div>
              </div>

              {selectedRecord.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{selectedRecord.errorMessage}</span>
                </div>
              )}

              {/* Granular Checks breakdown */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-neutral-900 uppercase tracking-wide">
                    EVALUATION CHECK DETAILS ({selectedRecord.checks.length})
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {selectedRecord.checks.filter((c) => c.passed).length} passed,{" "}
                    {selectedRecord.checks.filter((c) => !c.passed).length} failed
                  </span>
                </div>

                <div className="border border-neutral-200 divide-y divide-neutral-200 max-h-[480px] overflow-y-auto">
                  {selectedRecord.checks.map((chk, i) => (
                    <div
                      key={i}
                      className={`p-3 text-xs ${
                        chk.passed ? "bg-white" : "bg-red-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {chk.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-semibold text-neutral-900">
                              <span className="inline-block px-1.5 py-0.2 mr-1.5 text-[9px] uppercase font-bold bg-neutral-200 text-neutral-700">
                                {chk.category}
                              </span>
                              {chk.title}
                            </div>
                            {chk.message && (
                              <div
                                className={`text-[11px] mt-1 whitespace-pre-wrap ${
                                  chk.passed ? "text-neutral-500" : "text-red-700 font-mono"
                                }`}
                              >
                                {chk.message}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold ${
                              chk.passed ? "text-emerald-700" : "text-neutral-400"
                            }`}
                          >
                            +{chk.earned}/{chk.points}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center text-xs font-mono text-neutral-400">
              Select a student evaluation record on the left to view complete granular checks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
