"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Database, ShieldAlert, Play, RefreshCw, Trash2, Key, Server, CheckCircle2, XCircle, ChevronRight, UserCheck } from "lucide-react";

interface OracleConfig {
  host: string;
  port: number;
  serviceName: string;
  user: string;
  password: string;
  asSysdba: boolean;
}

interface DiscoveredNode {
  id: string;
  hostname: string;
  role: "manager" | "worker";
  ip: string;
  status: "ready" | "down" | "unknown";
}

export default function FacultyDashboard() {
  const [nodes, setNodes] = useState<DiscoveredNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [nodesLoading, setNodesLoading] = useState(false);

  const [config, setConfig] = useState<OracleConfig>({
    host: "127.0.0.1",
    port: 1521,
    serviceName: "FREEPDB1",
    user: "SYS",
    password: "LabDbPassword2026",
    asSysdba: true,
  });

  const [activeTab, setActiveTab] = useState<"sql" | "schema" | "sessions" | "rescue">("sql");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // SQL Console state
  const [sqlQuery, setSqlQuery] = useState("SELECT table_name, num_rows FROM all_tables WHERE owner = 'STUDENT'");
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[]; durationMs: number; rowsAffected: number } | null>(null);

  // Schema state
  const [schemaTables, setSchemaTables] = useState<any[]>([]);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);

  // Auto-fetch nodes on mount
  const fetchNodes = async () => {
    setNodesLoading(true);
    try {
      const res = await fetch("/api/nodes");
      const data = await res.json();
      if (data.success && data.nodes.length > 0) {
        setNodes(data.nodes);
        // Default to first worker or first node
        const first = data.nodes.find((n: DiscoveredNode) => n.role === "worker") || data.nodes[0];
        setSelectedNodeId(first.id);
        setConfig((prev) => ({ ...prev, host: first.ip }));
      }
    } catch {
      // Fallback
    } finally {
      setNodesLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const selectNode = (node: DiscoveredNode) => {
    setSelectedNodeId(node.id);
    setConfig((prev) => ({ ...prev, host: node.ip }));
    setStatusMsg({ text: `SELECTED NODE: ${node.hostname} (${node.ip})`, ok: true });
  };

  const applyPreset = (role: "sys" | "student") => {
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
  };

  const pingNode = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping", config }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `ONLINE // ${data.connectString}`, ok: true });
      } else {
        setStatusMsg({ text: `ERROR: ${data.error}`, ok: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: `OFFLINE: ${err.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const runQuery = async (customSql?: string) => {
    setLoading(true);
    setStatusMsg(null);
    const queryToRun = customSql || sqlQuery;
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", config, sql: queryToRun }),
      });
      const data = await res.json();
      if (data.success) {
        setQueryResult({
          columns: data.columns,
          rows: data.rows,
          durationMs: data.durationMs,
          rowsAffected: data.rowsAffected,
        });
        setStatusMsg({ text: `SUCCESS: ${data.rows.length} rows (${data.durationMs}ms)`, ok: true });
      } else {
        setStatusMsg({ text: `QUERY ERROR: ${data.error}`, ok: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: `EXECUTION FAILED: ${err.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const loadSchema = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-tables", config }),
      });
      const data = await res.json();
      if (data.success) {
        setSchemaTables(data.tables);
        setStatusMsg({ text: `SCHEMA: Loaded ${data.tables.length} tables for ${data.targetUser}`, ok: true });
      } else {
        setStatusMsg({ text: `SCHEMA ERROR: ${data.error}`, ok: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: `ERROR: ${err.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-sessions", config }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
        setStatusMsg({ text: `SESSIONS: ${data.sessions.length} active sessions`, ok: true });
      } else {
        setStatusMsg({ text: `SESSION ERROR: ${data.error}`, ok: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: `ERROR: ${err.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const killSession = async (sid: number, serial: number) => {
    if (!confirm(`KILL SESSION SID=${sid}, SERIAL#=${serial}?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill-session", config, sid, serial }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message, ok: true });
        loadSessions();
      } else {
        setStatusMsg({ text: `KILL FAILED: ${data.error}`, ok: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: `ERROR: ${err.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const unlockStudentAccount = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-student", config, newPassword: "StudentPassword123" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message, ok: true });
      } else {
        setStatusMsg({ text: `UNLOCK FAILED: ${data.error}`, ok: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: `ERROR: ${err.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-mono p-4 select-text">
      {/* Stark Monochromatic Header */}
      <header className="border-2 border-black bg-white p-3 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase">
            FACULTY_DB_CONSOLE // ORACLE 23C
          </h1>
          <p className="text-xs uppercase text-neutral-600">
            Automated Student Node Interventions
          </p>
        </div>

        <div className="flex items-center gap-2 border border-black px-3 py-1 bg-neutral-100 text-xs uppercase font-bold">
          <span>TARGET: {config.host}:{config.port}/{config.serviceName}</span>
          <span className="border-l border-black pl-2">ROLE: {config.user}</span>
        </div>
      </header>

      {/* Auto-Discovered Node Switcher */}
      <div className="border-2 border-black bg-white p-3 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase bg-black text-white px-2 py-0.5">
            [SWARM_STUDENT_NODES]
          </span>
          <button
            onClick={fetchNodes}
            disabled={nodesLoading}
            className="text-xs border border-black px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 uppercase font-bold flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${nodesLoading ? "animate-spin" : ""}`} /> Rescan Swarm
          </button>
        </div>

        {/* Node Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-3">
          {nodes.map((node) => {
            const isSelected = node.id === selectedNodeId || node.ip === config.host;
            return (
              <button
                key={node.id}
                onClick={() => selectNode(node)}
                className={`p-2 text-left border-2 border-black uppercase text-xs transition-none ${
                  isSelected ? "bg-black text-white font-bold" : "bg-neutral-50 hover:bg-neutral-100"
                }`}
              >
                <div className="truncate font-bold">{node.hostname}</div>
                <div className="text-[10px] opacity-75">{node.ip}</div>
                <div className="text-[9px] mt-1">[{node.role}]</div>
              </button>
            );
          })}
        </div>

        {/* Credentials & Connectivity Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase">Role:</span>
            <button
              onClick={() => applyPreset("sys")}
              className={`px-2 py-1 border border-black uppercase font-bold ${
                config.user === "SYS" ? "bg-black text-white" : "bg-white hover:bg-neutral-100"
              }`}
            >
              SYSDBA
            </button>
            <button
              onClick={() => applyPreset("student")}
              className={`px-2 py-1 border border-black uppercase font-bold ${
                config.user === "STUDENT" ? "bg-black text-white" : "bg-white hover:bg-neutral-100"
              }`}
            >
              STUDENT
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={pingNode}
              disabled={loading}
              className="px-3 py-1 bg-black text-white hover:bg-neutral-800 border border-black uppercase font-bold text-xs"
            >
              Ping Node
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-2 p-1.5 border border-black bg-neutral-100 text-xs font-bold uppercase">
            {statusMsg.ok ? "[OK] " : "[ERR] "} {statusMsg.text}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-[-2px] relative z-10">
        <button
          onClick={() => setActiveTab("sql")}
          className={`px-3 py-1.5 border-2 border-b-0 border-black text-xs font-bold uppercase ${
            activeTab === "sql" ? "bg-white text-black" : "bg-neutral-200 hover:bg-neutral-300"
          }`}
        >
          [1] SQL RUNNER
        </button>
        <button
          onClick={() => {
            setActiveTab("schema");
            loadSchema();
          }}
          className={`px-3 py-1.5 border-2 border-b-0 border-black text-xs font-bold uppercase ${
            activeTab === "schema" ? "bg-white text-black" : "bg-neutral-200 hover:bg-neutral-300"
          }`}
        >
          [2] SCHEMA EXPLORER
        </button>
        <button
          onClick={() => {
            setActiveTab("sessions");
            loadSessions();
          }}
          className={`px-3 py-1.5 border-2 border-b-0 border-black text-xs font-bold uppercase ${
            activeTab === "sessions" ? "bg-white text-black" : "bg-neutral-200 hover:bg-neutral-300"
          }`}
        >
          [3] ACTIVE SESSIONS
        </button>
        <button
          onClick={() => setActiveTab("rescue")}
          className={`px-3 py-1.5 border-2 border-b-0 border-black text-xs font-bold uppercase ${
            activeTab === "rescue" ? "bg-white text-black" : "bg-neutral-200 hover:bg-neutral-300"
          }`}
        >
          [4] RESCUE TOOLS
        </button>
      </div>

      {/* Main Tab Content */}
      <main className="border-2 border-black bg-white p-3 min-h-[400px]">
        {/* TAB 1: SQL RUNNER */}
        {activeTab === "sql" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase">QUERY INPUT:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => runQuery("SELECT * FROM v$version")}
                  className="border border-black px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 font-bold uppercase"
                >
                  Version
                </button>
                <button
                  onClick={() => runQuery("SELECT table_name, num_rows FROM all_tables WHERE owner = 'STUDENT'")}
                  className="border border-black px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 font-bold uppercase"
                >
                  Tables
                </button>
                <button
                  onClick={() => runQuery("SELECT * FROM v$locked_object")}
                  className="border border-black px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 font-bold uppercase"
                >
                  Locks
                </button>
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={4}
              className="w-full border-2 border-black p-2 font-mono text-xs bg-white text-black focus:outline-none"
              placeholder="Enter SQL command..."
            />

            <div className="flex justify-end">
              <button
                onClick={() => runQuery()}
                disabled={loading}
                className="px-4 py-1.5 bg-black text-white hover:bg-neutral-800 border-2 border-black font-bold uppercase text-xs"
              >
                EXECUTE SQL
              </button>
            </div>

            {queryResult && (
              <div className="border-2 border-black mt-2">
                <div className="bg-black text-white px-2 py-1 text-xs font-bold flex justify-between uppercase">
                  <span>ROWS: {queryResult.rows.length}</span>
                  <span>TIME: {queryResult.durationMs}ms</span>
                </div>
                <div className="max-h-80 overflow-auto">
                  {queryResult.rows.length > 0 ? (
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-neutral-100 border-b border-black uppercase font-bold sticky top-0">
                        <tr>
                          {queryResult.columns.map((col, idx) => (
                            <th key={idx} className="p-1.5 border-r border-black">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b border-neutral-300 hover:bg-neutral-100">
                            {queryResult.columns.map((col, colIdx) => (
                              <td key={colIdx} className="p-1.5 border-r border-neutral-300 whitespace-nowrap">
                                {String(row[col] ?? "NULL")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-3 text-xs text-neutral-500 font-bold">0 rows returned.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCHEMA EXPLORER */}
        {activeTab === "schema" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase">STUDENT TABLES:</span>
              <button
                onClick={loadSchema}
                disabled={loading}
                className="border border-black px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 font-bold uppercase"
              >
                Refresh
              </button>
            </div>

            {schemaTables.length > 0 ? (
              <div className="border-2 border-black overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-black text-white uppercase font-bold">
                    <tr>
                      <th className="p-1.5 text-left">TABLE_NAME</th>
                      <th className="p-1.5 text-left">NUM_ROWS</th>
                      <th className="p-1.5 text-left">STATUS</th>
                      <th className="p-1.5 text-left">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaTables.map((t, idx) => (
                      <tr key={idx} className="border-b border-neutral-300 hover:bg-neutral-100">
                        <td className="p-1.5 font-bold">{t.TABLE_NAME}</td>
                        <td className="p-1.5">{t.NUM_ROWS ?? "N/A"}</td>
                        <td className="p-1.5">{t.STATUS}</td>
                        <td className="p-1.5">
                          <button
                            onClick={() => {
                              setActiveTab("sql");
                              runQuery(`SELECT * FROM STUDENT.${t.TABLE_NAME} WHERE ROWNUM <= 50`);
                            }}
                            className="px-2 py-0.5 bg-neutral-100 border border-black font-bold uppercase text-[10px] hover:bg-black hover:text-white"
                          >
                            Query
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-xs font-bold text-neutral-500 border border-neutral-300">
                No student tables found.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SESSIONS */}
        {activeTab === "sessions" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase">ACTIVE USER SESSIONS:</span>
              <button
                onClick={loadSessions}
                disabled={loading}
                className="border border-black px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 font-bold uppercase"
              >
                Refresh
              </button>
            </div>

            {sessions.length > 0 ? (
              <div className="border-2 border-black overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-black text-white uppercase font-bold">
                    <tr>
                      <th className="p-1.5 text-left">SID, SERIAL#</th>
                      <th className="p-1.5 text-left">USER</th>
                      <th className="p-1.5 text-left">STATUS</th>
                      <th className="p-1.5 text-left">CLIENT</th>
                      <th className="p-1.5 text-left">LAST SQL</th>
                      <th className="p-1.5 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => (
                      <tr key={idx} className="border-b border-neutral-300 hover:bg-neutral-100">
                        <td className="p-1.5 font-bold">{s.SID}, {s["SERIAL#"]}</td>
                        <td className="p-1.5">{s.USERNAME || "INTERNAL"}</td>
                        <td className="p-1.5">{s.STATUS}</td>
                        <td className="p-1.5">{s.MACHINE}</td>
                        <td className="p-1.5 truncate max-w-xs">{s.SQL_TEXT || "IDLE"}</td>
                        <td className="p-1.5 text-center">
                          <button
                            onClick={() => killSession(s.SID, s["SERIAL#"])}
                            className="px-2 py-0.5 bg-black text-white hover:bg-neutral-800 border border-black font-bold uppercase text-[10px]"
                          >
                            Kill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-xs font-bold text-neutral-500 border border-neutral-300">
                No active user sessions.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RESCUE TOOLS */}
        {activeTab === "rescue" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="border-2 border-black p-3 bg-neutral-50">
              <div className="font-bold uppercase mb-1">UNLOCK STUDENT ACCOUNT</div>
              <p className="text-neutral-600 mb-3">
                Unlocks STUDENT account and sets password to StudentPassword123.
              </p>
              <button
                onClick={unlockStudentAccount}
                disabled={loading}
                className="w-full py-1.5 bg-black text-white hover:bg-neutral-800 border border-black font-bold uppercase"
              >
                Execute Unlock
              </button>
            </div>

            <div className="border-2 border-black p-3 bg-neutral-50">
              <div className="font-bold uppercase mb-1">FLUSH SHARED POOL & LOCKS</div>
              <p className="text-neutral-600 mb-3">
                Flushes shared memory pool to clear hung cached locks.
              </p>
              <button
                onClick={() => runQuery("ALTER SYSTEM FLUSH SHARED_POOL")}
                disabled={loading}
                className="w-full py-1.5 bg-black text-white hover:bg-neutral-800 border border-black font-bold uppercase"
              >
                Execute Flush
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
