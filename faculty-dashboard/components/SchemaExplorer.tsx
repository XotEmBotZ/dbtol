"use client";

import { useState, useEffect } from "react";
import { RefreshCw, ChevronRight, Loader2, TableProperties } from "lucide-react";
import type { OracleConfig, SchemaTable, StatusMessage } from "@/lib/types";
import { getTables } from "@/lib/oracle";
import { StatusBar } from "@/components/StatusBar";

interface SchemaExplorerProps {
  config: OracleConfig;
  /** Called when the user hits Query on a table — navigates to SQL Runner with this SQL pre-loaded */
  onQueryTable: (sql: string) => void;
}

export function SchemaExplorer({ config, onQueryTable }: SchemaExplorerProps) {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [targetUser, setTargetUser] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setStatus({ text: "Loading schema...", ok: true, type: "loading" });
    const resp = await getTables(config);
    setLoading(false);
    setHasLoaded(true);
    if (resp.ok && resp.tables) {
      setTables(resp.tables);
      setTargetUser(resp.targetUser ?? "");
      setStatus({
        text: `Loaded ${resp.tables.length} tables for schema: ${resp.targetUser}`,
        ok: true,
        type: "success",
      });
    } else {
      setTables([]);
      setStatus({ text: resp.error ?? "Unknown error", ok: false, type: "error" });
    }
  };

  // Load lazily on first mount (when view is activated)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-5 shrink-0 flex justify-between items-end border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-sans tracking-tight mb-1 font-semibold text-neutral-900">Schema Explorer</h1>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            owner: {targetUser || "STUDENT"}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-neutral-300 bg-white hover:bg-black hover:text-white hover:border-black disabled:opacity-40 transition-none shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status */}
      {status && (
        <div className="px-6 pt-4 shrink-0">
          <StatusBar status={status} />
        </div>
      )}

      {/* 2-col layout */}
      <div className="flex flex-1 min-h-0 p-6 gap-6">
        {/* Left tree */}
        <div className="w-56 border border-neutral-300 flex flex-col shrink-0 bg-white shadow-sm">
          <div className="bg-neutral-900 text-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
            Object Tree
          </div>
          <div className="p-3 overflow-y-auto text-[11px] font-mono">
            {loading && !hasLoaded ? (
              <div className="text-neutral-500 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <div className="font-bold cursor-pointer hover:text-blue-600">▼ {targetUser || "STUDENT"}</div>
                <div className="ml-3 mt-1.5 font-bold cursor-pointer hover:text-blue-600">▼ Tables</div>
                {tables.length === 0 && hasLoaded && (
                  <div className="ml-6 mt-1.5 text-neutral-400 italic">No tables</div>
                )}
                {tables.map((t) => (
                  <div
                    key={t.TABLE_NAME}
                    onClick={() =>
                      onQueryTable(
                        `SELECT * FROM ${targetUser || "STUDENT"}.${t.TABLE_NAME} WHERE ROWNUM <= 50`
                      )
                    }
                    className="ml-6 mt-1.5 text-neutral-600 truncate cursor-pointer hover:text-blue-600 py-0.5"
                  >
                    {t.TABLE_NAME}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right table */}
        <div className="flex-1 border border-neutral-300 flex flex-col min-w-0 bg-white shadow-sm">
          {hasLoaded && tables.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full text-[11px] font-mono text-neutral-400 uppercase">
              No student tables found.
            </div>
          )}

          {tables.length > 0 && (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px] font-mono border-collapse">
                <thead className="sticky top-0 bg-blue-50 border-b border-neutral-300 text-blue-900">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] tracking-wide border-r border-neutral-300">
                      TABLE_NAME
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold uppercase text-[10px] tracking-wide border-r border-neutral-300">
                      NUM_ROWS
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] tracking-wide border-r border-neutral-300">
                      TABLESPACE
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] tracking-wide border-r border-neutral-300">
                      STATUS
                    </th>
                    <th className="px-3 py-2.5 text-center font-bold uppercase text-[10px] tracking-wide w-24">
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-neutral-200 hover:bg-blue-50/40 even:bg-neutral-50/60"
                    >
                      <td className="px-3 py-2 font-bold text-neutral-900 border-r border-neutral-200">
                        {t.TABLE_NAME}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-700 border-r border-neutral-200">
                        {t.NUM_ROWS != null ? (
                          t.NUM_ROWS.toLocaleString()
                        ) : (
                          <span className="text-neutral-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-600 border-r border-neutral-200">
                        {t.TABLESPACE_NAME ?? (
                          <span className="text-neutral-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-neutral-200">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border ${
                            t.STATUS === "VALID"
                              ? "border-green-400 text-green-700 bg-green-50"
                              : "border-red-400 text-red-700 bg-red-50"
                          }`}
                        >
                          {t.STATUS}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() =>
                            onQueryTable(
                              `SELECT * FROM ${targetUser || "STUDENT"}.${t.TABLE_NAME} WHERE ROWNUM <= 50`
                            )
                          }
                          className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono font-bold uppercase border border-blue-400 text-blue-700 bg-white hover:bg-blue-50 transition-none mx-auto"
                        >
                          <ChevronRight className="w-2.5 h-2.5" />
                          Query
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
