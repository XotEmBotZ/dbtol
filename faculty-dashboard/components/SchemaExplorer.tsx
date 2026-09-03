"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Key, Link2, ShieldCheck, CheckCircle2, ChevronRight, Loader2, TableProperties, ArrowLeft, Terminal } from "lucide-react";
import type { OracleConfig, SchemaTable, TableSchemaDetail, StatusMessage } from "@/lib/types";
import { getTables, getTableSchema } from "@/lib/oracle";
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

  // Selected table schema view
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<TableSchemaDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

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

  const inspectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setSchemaLoading(true);
    const resp = await getTableSchema(config, tableName);
    setSchemaLoading(false);
    if (resp.ok && resp.schema) {
      setTableSchema(resp.schema);
    } else {
      setTableSchema(null);
      setStatus({ text: resp.error ?? `Failed to load schema for ${tableName}`, ok: false, type: "error" });
    }
  };

  // Load lazily on first mount
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getConstraintBadge = (type: string) => {
    switch (type) {
      case "P":
        return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border border-amber-400 text-amber-800 bg-amber-50"><Key className="w-2.5 h-2.5" /> PRIMARY KEY</span>;
      case "R":
        return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border border-blue-400 text-blue-800 bg-blue-50"><Link2 className="w-2.5 h-2.5" /> FOREIGN KEY</span>;
      case "U":
        return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border border-purple-400 text-purple-800 bg-purple-50"><CheckCircle2 className="w-2.5 h-2.5" /> UNIQUE</span>;
      case "C":
        return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border border-emerald-400 text-emerald-800 bg-emerald-50"><ShieldCheck className="w-2.5 h-2.5" /> CHECK</span>;
      default:
        return <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border border-neutral-300 text-neutral-600 bg-neutral-50">{type}</span>;
    }
  };

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
                    onClick={() => inspectTable(t.TABLE_NAME)}
                    className={`ml-6 mt-1.5 truncate cursor-pointer py-0.5 transition-colors ${
                      selectedTable === t.TABLE_NAME
                        ? "text-blue-700 font-bold bg-blue-50 px-1"
                        : "text-neutral-600 hover:text-blue-600"
                    }`}
                  >
                    {t.TABLE_NAME}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right content: Tables list OR Table Schema Detail */}
        <div className="flex-1 border border-neutral-300 flex flex-col min-w-0 bg-white shadow-sm overflow-hidden">
          {selectedTable ? (
            /* ── Table Schema Inspector ── */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-3 bg-neutral-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="p-1 text-neutral-400 hover:text-white transition-colors"
                    title="Back to all tables"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-sm font-bold tracking-wide">
                    {targetUser || "STUDENT"}.{selectedTable}
                  </span>
                </div>
                <button
                  onClick={() =>
                    onQueryTable(`SELECT * FROM ${targetUser || "STUDENT"}.${selectedTable} WHERE ROWNUM <= 50`)
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-white text-black hover:bg-neutral-200 transition-none"
                >
                  <Terminal className="w-3 h-3" />
                  Open in SQL Runner
                </button>
              </div>

              {schemaLoading ? (
                <div className="flex-1 flex items-center justify-center font-mono text-xs text-neutral-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading table schema & constraints...
                </div>
              ) : tableSchema ? (
                <div className="flex-1 overflow-auto p-4 space-y-6">
                  {/* Columns */}
                  <div>
                    <h2 className="text-xs font-mono font-bold uppercase text-neutral-700 mb-2 tracking-wider flex items-center gap-1.5">
                      <TableProperties className="w-3.5 h-3.5 text-blue-600" /> Columns ({tableSchema.columns.length})
                    </h2>
                    <div className="border border-neutral-200 overflow-x-auto">
                      <table className="w-full text-[11px] font-mono border-collapse">
                        <thead className="bg-neutral-100 text-neutral-700 text-[10px] uppercase font-bold border-b border-neutral-200">
                          <tr>
                            <th className="px-3 py-2 text-left border-r border-neutral-200">Column Name</th>
                            <th className="px-3 py-2 text-left border-r border-neutral-200">Data Type</th>
                            <th className="px-3 py-2 text-center border-r border-neutral-200">Nullable</th>
                            <th className="px-3 py-2 text-left">Default Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableSchema.columns.map((c, i) => (
                            <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                              <td className="px-3 py-1.5 font-bold text-neutral-900 border-r border-neutral-200">{c.COLUMN_NAME}</td>
                              <td className="px-3 py-1.5 text-blue-700 border-r border-neutral-200">
                                {c.DATA_TYPE}
                                {c.DATA_PRECISION != null
                                  ? `(${c.DATA_PRECISION},${c.DATA_SCALE || 0})`
                                  : c.DATA_LENGTH && !["NUMBER", "DATE", "TIMESTAMP"].some(t => c.DATA_TYPE.includes(t))
                                  ? `(${c.DATA_LENGTH})`
                                  : ""}
                              </td>
                              <td className="px-3 py-1.5 text-center border-r border-neutral-200">
                                {c.NULLABLE === "Y" ? (
                                  <span className="text-neutral-400 text-[9px]">NULL</span>
                                ) : (
                                  <span className="text-red-700 font-bold text-[9px]">NOT NULL</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-neutral-600 truncate max-w-xs">{c.DATA_DEFAULT || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Constraints */}
                  <div>
                    <h2 className="text-xs font-mono font-bold uppercase text-neutral-700 mb-2 tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Constraints ({tableSchema.constraints.length})
                    </h2>
                    {tableSchema.constraints.length === 0 ? (
                      <div className="p-3 text-[10px] font-mono text-neutral-400 border border-neutral-200 italic">
                        No constraints defined on this table.
                      </div>
                    ) : (
                      <div className="border border-neutral-200 overflow-x-auto">
                        <table className="w-full text-[11px] font-mono border-collapse">
                          <thead className="bg-neutral-100 text-neutral-700 text-[10px] uppercase font-bold border-b border-neutral-200">
                            <tr>
                              <th className="px-3 py-2 text-left border-r border-neutral-200">Constraint Name</th>
                              <th className="px-3 py-2 text-left border-r border-neutral-200">Type</th>
                              <th className="px-3 py-2 text-left border-r border-neutral-200">Column</th>
                              <th className="px-3 py-2 text-left border-r border-neutral-200">References / Target</th>
                              <th className="px-3 py-2 text-left">Condition / Rule</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableSchema.constraints.map((c, i) => (
                              <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                                <td className="px-3 py-1.5 font-bold text-neutral-900 border-r border-neutral-200">{c.CONSTRAINT_NAME}</td>
                                <td className="px-3 py-1.5 border-r border-neutral-200">{getConstraintBadge(c.CONSTRAINT_TYPE)}</td>
                                <td className="px-3 py-1.5 text-neutral-800 font-bold border-r border-neutral-200">{c.COLUMN_NAME || "—"}</td>
                                <td className="px-3 py-1.5 text-blue-700 border-r border-neutral-200">
                                  {c.R_TABLE_NAME ? `${c.R_TABLE_NAME} (${c.R_CONSTRAINT_NAME})` : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-neutral-600 text-[10px]">
                                  {c.SEARCH_CONDITION || (c.DELETE_RULE ? `ON DELETE ${c.DELETE_RULE}` : "—")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Indexes */}
                  {tableSchema.indexes.length > 0 && (
                    <div>
                      <h2 className="text-xs font-mono font-bold uppercase text-neutral-700 mb-2 tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-600" /> Indexes ({tableSchema.indexes.length})
                      </h2>
                      <div className="border border-neutral-200 overflow-x-auto">
                        <table className="w-full text-[11px] font-mono border-collapse">
                          <thead className="bg-neutral-100 text-neutral-700 text-[10px] uppercase font-bold border-b border-neutral-200">
                            <tr>
                              <th className="px-3 py-2 text-left border-r border-neutral-200">Index Name</th>
                              <th className="px-3 py-2 text-left border-r border-neutral-200">Uniqueness</th>
                              <th className="px-3 py-2 text-left">Column</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableSchema.indexes.map((idx, i) => (
                              <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                                <td className="px-3 py-1.5 font-bold text-neutral-900 border-r border-neutral-200">{idx.INDEX_NAME}</td>
                                <td className="px-3 py-1.5 border-r border-neutral-200">
                                  <span className={`text-[9px] font-bold uppercase px-1 py-0.5 border ${idx.UNIQUENESS === "UNIQUE" ? "border-purple-400 text-purple-800 bg-purple-50" : "border-neutral-300 text-neutral-600"}`}>
                                    {idx.UNIQUENESS}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-neutral-800">{idx.COLUMN_NAME} (Pos: {idx.COLUMN_POSITION})</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            /* ── Tables List View ── */
            <>
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
                        <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] tracking-wide border-r border-neutral-300">
                          TABLESPACE
                        </th>
                        <th className="px-3 py-2.5 text-center font-bold uppercase text-[10px] tracking-wide w-28">
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
                          <td
                            onClick={() => inspectTable(t.TABLE_NAME)}
                            className="px-3 py-2 font-bold text-neutral-900 border-r border-neutral-200 cursor-pointer hover:text-blue-700"
                          >
                            {t.TABLE_NAME}
                          </td>
                          <td className="px-3 py-2 text-neutral-600 border-r border-neutral-200">
                            {t.TABLESPACE_NAME ?? (
                              <span className="text-neutral-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => inspectTable(t.TABLE_NAME)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono font-bold uppercase border border-blue-400 text-blue-700 bg-white hover:bg-blue-50 transition-none mx-auto shadow-sm"
                            >
                              <TableProperties className="w-3 h-3" />
                              Schema
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
