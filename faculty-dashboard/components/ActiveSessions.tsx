"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Loader2, Skull } from "lucide-react";
import type { OracleConfig, OracleSession, StatusMessage } from "@/lib/types";
import { getSessions, killSession } from "@/lib/oracle";
import { StatusBar } from "@/components/StatusBar";

interface ActiveSessionsProps {
  config: OracleConfig;
}

function SessionStatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") {
    return (
      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border border-green-400 text-green-700 bg-green-50">
        ACTIVE
      </span>
    );
  }
  if (s === "KILLED") {
    return (
      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border border-red-400 text-red-700 bg-red-50">
        KILLED
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border border-neutral-300 text-neutral-500">
      {s ?? "—"}
    </span>
  );
}

export function ActiveSessions({ config }: ActiveSessionsProps) {
  const [sessions, setSessions] = useState<OracleSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setStatus({ text: "Loading sessions...", ok: true, type: "loading" });
    const resp = await getSessions(config);
    setLoading(false);
    setHasLoaded(true);
    if (resp.ok && resp.sessions) {
      setSessions(resp.sessions);
      setStatus({
        text: `${resp.sessions.length} session${resp.sessions.length !== 1 ? "s" : ""} found`,
        ok: true,
        type: "success",
      });
    } else {
      setSessions([]);
      setStatus({ text: resp.error ?? "Unknown error", ok: false, type: "error" });
    }
  };

  const handleKill = async (sid: number, serial: number) => {
    const key = `${sid},${serial}`;
    if (
      !confirm(
        `Kill session SID=${sid}, SERIAL#=${serial}?\n\nThis will immediately terminate the database session.`
      )
    )
      return;
    setKilling(key);
    const resp = await killSession(config, sid, serial);
    setKilling(null);
    if (resp.ok) {
      setStatus({ text: resp.message ?? `Session ${key} terminated`, ok: true, type: "success" });
      load();
    } else {
      setStatus({ text: resp.error ?? "Kill failed", ok: false, type: "error" });
    }
  };

  // Lazy load when view is activated
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full bg-white p-6">
      {/* Header */}
      <div className="mb-6 border-b-2 border-black pb-2 flex justify-between items-end">
        <h1 className="text-2xl font-sans font-bold tracking-widest uppercase text-neutral-900">
          ACTIVE SESSIONS
        </h1>
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
        <div className="pb-4 shrink-0">
          <StatusBar status={status} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto border border-neutral-300 shadow-sm bg-white min-h-0">
        {loading && !hasLoaded && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading sessions...
          </div>
        )}

        {hasLoaded && sessions.length === 0 && !loading && (
          <div className="py-8 text-center text-[11px] font-mono text-neutral-400 uppercase">
            No active user sessions.
          </div>
        )}

        {sessions.length > 0 && (
          <div className="min-w-max">
            <table className="w-full text-[11px] font-mono border-collapse">
              <thead className="sticky top-0 bg-blue-50 border-b border-neutral-300 text-blue-900">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] border-r border-neutral-300">
                    SID, SN#
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] border-r border-neutral-300">
                    USER
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] border-r border-neutral-300">
                    STATUS
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] border-r border-neutral-300">
                    MACHINE
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] border-r border-neutral-300">
                    PROGRAM
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold uppercase text-[10px] border-r border-neutral-300">
                    IDLE (s)
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10px] border-r border-neutral-300 max-w-64">
                    LAST SQL
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold uppercase text-[10px] w-16">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const key = `${s.SID},${s["SERIAL#"]}`;
                  const isBeingKilled = killing === key;
                  const isKilled = s.STATUS?.toUpperCase() === "KILLED";
                  const isRowActive = s.STATUS?.toUpperCase() === "ACTIVE";
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-neutral-200 ${
                        isKilled ? "bg-red-50/50" : isRowActive ? "bg-green-50/30" : "even:bg-neutral-50/60"
                      } hover:bg-blue-50/40`}
                    >
                      <td className="px-3 py-2 font-bold text-neutral-900 border-r border-neutral-200 whitespace-nowrap">
                        {s.SID}, {s["SERIAL#"]}
                      </td>
                      <td className="px-3 py-2 text-neutral-700 border-r border-neutral-200">
                        {s.USERNAME ?? <span className="text-neutral-400 italic">INTERNAL</span>}
                      </td>
                      <td className="px-3 py-2 border-r border-neutral-200">
                        <SessionStatusBadge status={s.STATUS} />
                      </td>
                      <td className="px-3 py-2 text-neutral-600 border-r border-neutral-200 max-w-32 truncate">
                        {s.MACHINE ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-neutral-600 border-r border-neutral-200 max-w-32 truncate">
                        {s.PROGRAM ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-600 border-r border-neutral-200">
                        {s.SECONDS_IDLE ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-neutral-500 border-r border-neutral-200 max-w-64 truncate">
                        {s.SQL_TEXT ?? <span className="italic text-neutral-400">IDLE</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleKill(s.SID, s["SERIAL#"])}
                          disabled={isBeingKilled}
                          className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase border border-red-300 text-red-600 bg-white hover:bg-red-50 disabled:opacity-40 transition-none mx-auto"
                        >
                          {isBeingKilled ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Skull className="w-2.5 h-2.5" />
                          )}
                          Kill
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
