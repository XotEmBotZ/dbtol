"use client";

import { useState } from "react";
import { Play, Loader2, Zap } from "lucide-react";
import type { OracleConfig, QueryResult, StatusMessage } from "@/lib/types";
import { runQuery } from "@/lib/oracle";
import { QueryResults } from "@/components/QueryResults";
import { StatusBar } from "@/components/StatusBar";

interface SQLRunnerProps {
  config: OracleConfig;
  /** Pre-populated query (e.g. from Schema Explorer navigation) */
  initialQuery?: string;
  onQueryReady?: (result: QueryResult) => void;
}

const QUICK_QUERIES: { label: string; sql: string }[] = [
  { label: "VERSION", sql: "SELECT * FROM v$version" },
  { label: "TABLES", sql: "SELECT table_name, num_rows FROM all_tables WHERE owner = 'STUDENT' ORDER BY table_name" },
  { label: "SESSIONS", sql: "SELECT sid, serial#, username, status, machine, program, sql_id FROM v$session WHERE type != 'BACKGROUND'" },
  { label: "LOCKS", sql: "SELECT session_id, oracle_username, os_user_name, locked_mode FROM v$locked_object" },
  { label: "CURRENT TIME", sql: "SELECT SYSDATE FROM dual" },
];

export function SQLRunner({ config, initialQuery }: SQLRunnerProps) {
  const [sql, setSql] = useState(
    initialQuery ?? "SELECT table_name, num_rows FROM all_tables WHERE owner = 'STUDENT'"
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  const execute = async (customSql?: string) => {
    const queryToRun = customSql ?? sql;
    if (!queryToRun.trim()) return;
    setLoading(true);
    setStatus({ text: "Executing...", ok: true, type: "loading" });
    const resp = await runQuery(config, queryToRun);
    setLoading(false);
    if (resp.ok && resp.result) {
      setResult(resp.result);
      setStatus({
        text: `${resp.result.rows.length} rows returned in ${resp.result.durationMs}ms`,
        ok: true,
        type: "success",
      });
    } else {
      setResult(null);
      setStatus({ text: resp.error ?? "Unknown error", ok: false, type: "error", code: resp.code });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter / Cmd+Enter to execute
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      execute();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-neutral-50 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase font-mono text-neutral-500 mr-2">
            Quick:
          </span>
          {QUICK_QUERIES.map((q) => (
            <button
              key={q.label}
              onClick={() => {
                setSql(q.sql);
                execute(q.sql);
              }}
              disabled={loading}
              className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase border border-neutral-300 bg-white hover:bg-black hover:text-white hover:border-black disabled:opacity-40 transition-none"
            >
              {q.label}
            </button>
          ))}
        </div>
        <span className="text-[9px] font-mono text-neutral-400 uppercase">
          Ctrl+Enter to run
        </span>
      </div>

      {/* SQL Editor */}
      <div className="px-4 pt-3 pb-0 shrink-0">
        <div className="border border-neutral-300 focus-within:border-black transition-none">
          <div className="bg-neutral-900 px-3 py-1 flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase text-neutral-500">SQL &gt;</span>
          </div>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            spellCheck={false}
            className="w-full px-3 py-2.5 font-mono text-[12px] bg-neutral-950 text-green-300 focus:outline-none resize-none leading-relaxed"
            placeholder="Enter SQL statement..."
          />
        </div>
      </div>

      {/* Execute row */}
      <div className="px-4 pt-2 pb-3 flex items-center justify-between shrink-0">
        {status ? (
          <StatusBar status={status} className="flex-1 mr-3" />
        ) : (
          <div />
        )}
        <button
          onClick={() => execute()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-1.5 bg-black text-white hover:bg-neutral-800 font-bold uppercase text-[11px] font-mono border border-black disabled:opacity-40 transition-none shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          EXECUTE SQL
        </button>
      </div>

      {/* Results */}
      <div className="px-4 pb-4 flex-1 overflow-auto">
        {result && <QueryResults result={result} />}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-400 gap-2">
            <Zap className="w-5 h-5 text-neutral-300" />
            <span className="text-[11px] font-mono uppercase">No results yet — execute a query above</span>
          </div>
        )}
      </div>
    </div>
  );
}
