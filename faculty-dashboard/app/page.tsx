"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { OracleConfig, DiscoveredNode, ActiveView, StatusMessage, StudentRecord } from "@/lib/types";
import { fetchNodes } from "@/lib/nodes";
import { pingOracle } from "@/lib/oracle";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DatabaseToolsPage } from "@/components/DatabaseToolsPage";
import { StatusBar } from "@/components/StatusBar";
import { Evaluation } from "@/components/Evaluation";
import { StudentsManager } from "@/components/StudentsManager";
import { EvaluationHistory } from "@/components/EvaluationHistory";
import { NodeSelectModal } from "@/components/NodeSelectModal";

export default function FacultyDashboard() {
  // ── Node state ──────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<DiscoveredNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodeModalOpen, setNodeModalOpen] = useState(false);

  // ── Students state for occupancy tracking ───────────────────────────────────
  const [students, setStudents] = useState<StudentRecord[]>([]);

  // ── Oracle connection config ─────────────────────────────────────────────────
  const [config, setConfig] = useState<OracleConfig>({
    host: "127.0.0.1",
    port: 1521,
    serviceName: "FREEPDB1",
    user: "SYS",
    password: "LabDbPassword2026",
    asSysdba: true,
  });

  // ── Navigation (default to student evaluation) ────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>("evaluation");
  const [selectedEvalDetailId, setSelectedEvalDetailId] = useState<string | undefined>(undefined);

  // ── Global status (ping, rescan, node select) ────────────────────────────────
  const [globalStatus, setGlobalStatus] = useState<StatusMessage | null>(null);
  const [pingLoading, setPingLoading] = useState(false);

  // ── SQL Runner: pre-populated query from Schema Explorer ─────────────────────
  const [pendingSql, setPendingSql] = useState<string | undefined>(undefined);
  // Key to force re-mount of SQLRunner when Schema Explorer navigates to it
  const sqlRunnerKey = useRef(0);

  // ── Node discovery ───────────────────────────────────────────────────────────
  const loadNodes = useCallback(async () => {
    setNodesLoading(true);
    try {
      const discovered = await fetchNodes();
      if (discovered.length > 0) {
        setNodes(discovered);
        // Default to first worker, or first node
        const first =
          discovered.find((n) => n.role === "worker") ?? discovered[0];
        setSelectedNodeId(first.id);
        setConfig((prev) => ({
          ...prev,
          host: first.dbIp || first.ip,
          port: first.dbPort || prev.port,
        }));
      }
    } finally {
      setNodesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
    // Fetch students list for seating occupancy
    fetch("/api/students")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.students) {
          setStudents(data.students);
        }
      })
      .catch(() => {});
  }, [loadNodes]);

  // ── Node selection ───────────────────────────────────────────────────────────
  const handleSelectNode = useCallback((node: DiscoveredNode) => {
    setSelectedNodeId(node.id);
    setConfig((prev) => ({
      ...prev,
      host: node.dbIp || node.ip,
      port: node.dbPort || prev.port,
    }));
    setGlobalStatus({
      text: `Selected node: ${node.hostname} (DB: ${node.dbIp || node.ip}:${node.dbPort || 1521})`,
      ok: true,
      type: "success",
    });
  }, []);

  // ── Role preset ──────────────────────────────────────────────────────────────
  const handleApplyPreset = useCallback((role: "sys" | "student") => {
    if (role === "sys") {
      setConfig((prev) => ({
        ...prev,
        user: "SYS",
        password: "LabDbPassword2026",
        asSysdba: true,
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        user: "STUDENT",
        password: "StudentPassword123",
        asSysdba: false,
      }));
    }
  }, []);

  // ── Update Config ────────────────────────────────────────────────────────────
  const handleUpdateConfig = useCallback((patch: Partial<OracleConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Ping ─────────────────────────────────────────────────────────────────────
  const handlePingNode = useCallback(async () => {
    setPingLoading(true);
    setGlobalStatus({ text: "Pinging node...", ok: true, type: "loading" });
    const resp = await pingOracle(config);
    setPingLoading(false);
    if (resp.ok) {
      setGlobalStatus({
        text: `ONLINE // ${resp.connectString}`,
        ok: true,
        type: "success",
      });
    } else {
      setGlobalStatus({
        text: `OFFLINE: ${resp.error}`,
        ok: false,
        type: "error",
      });
    }
  }, [config]);

  // ── Schema Explorer → SQL Runner navigation ──────────────────────────────────
  const handleQueryTable = useCallback((sql: string) => {
    sqlRunnerKey.current += 1;
    setPendingSql(sql);
    setActiveView("sql");
  }, []);

  // ── Sidebar navigation ────────────────────────────────────────────────────────
  const handleNavigate = useCallback((view: ActiveView) => {
    setActiveView(view);
  }, []);

  const handleSelectStudentForEval = useCallback((student: StudentRecord) => {
    if (student.targetIp) {
      setConfig((prev) => ({
        ...prev,
        host: student.targetIp!,
        port: student.targetPort || prev.port,
      }));
    }
    if (student.targetNodeId) {
      setSelectedNodeId(student.targetNodeId);
    }
    setActiveView("evaluation");
  }, []);

  const handleViewRecordDetail = useCallback((evalId: string) => {
    setSelectedEvalDetailId(evalId);
    setActiveView("evaluations_history");
  }, []);

  // ── Mobile sidebar toggle ─────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden bg-[#f4f2ee]">
      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 transition-transform duration-200
          md:relative md:translate-x-0 md:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Sidebar
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          nodesLoading={nodesLoading}
          activeView={activeView}
          students={students}
          onOpenNodeModal={() => setNodeModalOpen(true)}
          onNavigate={handleNavigate}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <div className="flex items-center md:hidden bg-black px-3 py-2 border-b border-neutral-800 shrink-0">
          <button
            type="button"
            className="text-white p-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <span className="text-white font-mono text-xs font-bold uppercase">
            FACULTY_DB_CONSOLE
          </span>
        </div>

        {/* Header (desktop) */}
        <div className="hidden md:block shrink-0">
          <Header
            config={config}
            loading={pingLoading}
            onApplyPreset={handleApplyPreset}
            onPingNode={handlePingNode}
            onRescan={loadNodes}
            onUpdateConfig={handleUpdateConfig}
          />
        </div>

        {/* Mobile header controls */}
        <div className="md:hidden bg-black border-b border-neutral-800 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleApplyPreset("sys")}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase font-mono border ${
                config.user === "SYS"
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-neutral-400 border-neutral-700"
              }`}
            >
              SYSDBA
            </button>
            <button
              onClick={() => handleApplyPreset("student")}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase font-mono border ${
                config.user === "STUDENT"
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-neutral-400 border-neutral-700"
              }`}
            >
              STUDENT
            </button>
            <span className="text-[10px] font-mono text-neutral-500">
              {config.host}:{config.port}/{config.serviceName}
            </span>
            <button
              onClick={handlePingNode}
              disabled={pingLoading}
              className="px-2 py-0.5 text-[10px] font-mono text-neutral-400 border border-neutral-700 uppercase"
            >
              Ping
            </button>
          </div>
        </div>

        {/* Global status bar */}
        {globalStatus && (
          <div className="px-4 pt-2 shrink-0">
            <StatusBar status={globalStatus} />
          </div>
        )}

        {/* Workspace content */}
        <div className="flex-1 overflow-hidden h-full">
          {/* Workspace panel */}
          <div className="h-full overflow-hidden bg-white">
            <div className="h-full overflow-auto bg-white border-r border-neutral-200">
              {/* 1. Evaluation Runner */}
              <div style={{ display: activeView === "evaluation" ? "block" : "none" }}>
                <Evaluation
                  config={config}
                  node={nodes.find((n) => n.id === selectedNodeId)}
                  nodes={nodes}
                  onViewRecordDetail={handleViewRecordDetail}
                />
              </div>

              {/* 2. Detailed View & Evaluation Records */}
              {activeView === "evaluations_history" && (
                <EvaluationHistory
                  initialEvaluationId={selectedEvalDetailId}
                  onBackToEvaluation={() => setActiveView("evaluation")}
                />
              )}

              {/* 3. Students Directory / Upload / Edit */}
              {activeView === "students" && (
                <StudentsManager
                  nodes={nodes}
                  onSelectStudentForEval={handleSelectStudentForEval}
                />
              )}

              {/* 4. Dedicated DB-Specific Page (Health, Schema, SQL Runner, Sessions) */}
              {activeView === "health" && (
                <DatabaseToolsPage
                  config={config}
                  selectedNode={nodes.find((n) => n.id === selectedNodeId)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Node Selection & Occupancy Modal */}
      <NodeSelectModal
        isOpen={nodeModalOpen}
        onClose={() => setNodeModalOpen(false)}
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        students={students}
        nodesLoading={nodesLoading}
        onRescan={loadNodes}
        onSelectNode={handleSelectNode}
      />
    </div>
  );
}
