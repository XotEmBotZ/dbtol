"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert, Loader2, CheckCircle2, XCircle, Lock, Skull } from "lucide-react";
import type { OracleConfig, StatusMessage } from "@/lib/types";
import { resetStudentAccount, runQuery } from "@/lib/oracle";
import { StatusBar } from "@/components/StatusBar";

interface RescueToolsProps {
  config: OracleConfig;
}

interface RescueActionState {
  loading: boolean;
  status: StatusMessage | null;
}

export function RescueTools({ config }: RescueToolsProps) {
  const [unlockState, setUnlockState] = useState<RescueActionState>({ loading: false, status: null });
  const [flushState, setFlushState] = useState<RescueActionState>({ loading: false, status: null });

  const handleUnlock = async () => {
    if (
      !confirm(
        "Unlock STUDENT account?\n\nThis will:\n• Unlock the STUDENT database user\n• Reset the password to the lab default\n\nProceed?"
      )
    )
      return;

    setUnlockState({ loading: true, status: { text: "Unlocking account...", ok: true, type: "loading" } });
    const resp = await resetStudentAccount(config);
    setUnlockState({
      loading: false,
      status: resp.ok
        ? { text: resp.message ?? "Account unlocked successfully", ok: true, type: "success" }
        : { text: resp.error ?? "Unlock failed", ok: false, type: "error" },
    });
  };

  const handleFlush = async () => {
    if (
      !confirm(
        "Flush Shared Pool?\n\nThis will:\n• Execute ALTER SYSTEM FLUSH SHARED_POOL\n• Clear cached SQL and locks from shared memory\n• May briefly impact active queries\n\nProceed?"
      )
    )
      return;

    setFlushState({ loading: true, status: { text: "Flushing shared pool...", ok: true, type: "loading" } });
    const resp = await runQuery(config, "ALTER SYSTEM FLUSH SHARED_POOL");
    setFlushState({
      loading: false,
      status: resp.ok
        ? { text: "Shared pool flushed successfully", ok: true, type: "success" }
        : { text: resp.error ?? "Flush failed", ok: false, type: "error" },
    });
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-auto p-6">
      {/* Header */}
      <div className="mb-6 border-b-2 border-black pb-2 inline-flex">
        <h1 className="text-2xl font-sans font-bold tracking-widest uppercase text-neutral-900">
          RESCUE_TOOLS
        </h1>
      </div>

      <div className="max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* ─── Unlock Student Account ─── */}
          <div className="border border-neutral-300 bg-white flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-neutral-200 font-bold text-xs uppercase flex items-center gap-2 bg-neutral-50 text-neutral-800 tracking-wide">
              <Lock className="w-4 h-4 text-blue-600" />
              UNLOCK STUDENT ACCT
              {unlockState.loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto text-neutral-400" />}
            </div>
            <div className="p-4 flex-1">
              <p className="text-[11px] font-mono text-neutral-600 leading-relaxed mb-1">
                Unlocks the <span className="font-bold text-neutral-900">STUDENT</span> Oracle
                user account and resets the password to the lab default.
              </p>
              <p className="text-[10px] font-mono text-neutral-500 leading-relaxed mt-2">
                Use when: account is locked after too many failed login attempts, or password
                needs resetting for a lab session.
              </p>
            </div>
            {unlockState.status && (
              <div className="mx-4 mb-3">
                <StatusBar status={unlockState.status} />
              </div>
            )}
            <div className="px-4 pb-4">
              <button
                onClick={handleUnlock}
                disabled={unlockState.loading}
                className="w-full flex items-center justify-center gap-2 py-2 border border-neutral-400 bg-black text-white hover:bg-neutral-800 font-bold uppercase text-[11px] font-mono disabled:opacity-40 transition-none"
              >
                Execute Unlock
              </button>
            </div>
          </div>

          {/* ─── Flush Shared Pool ─── */}
          <div className="border border-neutral-300 bg-white flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-neutral-200 font-bold text-xs uppercase flex items-center gap-2 bg-neutral-50 text-neutral-800 tracking-wide">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              FLUSH SHARED_POOL
              {flushState.loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto text-neutral-400" />}
            </div>
            <div className="p-4 flex-1">
              <p className="text-[11px] font-mono text-neutral-600 leading-relaxed mb-4">
                Executes <span className="font-bold text-neutral-900 font-mono">ALTER SYSTEM FLUSH SHARED_POOL</span> to
                clear shared memory cache and release hung cached locks.
              </p>
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p className="text-[10px] font-mono leading-relaxed font-bold">
                  ATTENTION: This will clear cached SQL and impact running queries.
                </p>
              </div>
            </div>
            {flushState.status && (
              <div className="mx-4 mb-3">
                <StatusBar status={flushState.status} />
              </div>
            )}
            <div className="px-4 pb-4">
              <button
                onClick={handleFlush}
                disabled={flushState.loading}
                className="w-full flex items-center justify-center gap-2 py-2 border border-red-200 bg-white text-red-600 hover:bg-red-50 font-bold uppercase text-[11px] font-mono disabled:opacity-40 transition-none"
              >
                Execute Flush
              </button>
            </div>
          </div>
        </div>

        {/* ─── Reap Orphaned Sessions (NOT IMPLEMENTED) ─── */}
        <div className="border border-neutral-300 bg-neutral-50 flex flex-col opacity-75 shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 font-bold text-xs uppercase flex items-center gap-2 text-neutral-800 tracking-wide bg-white">
            <Skull className="w-4 h-4 text-neutral-600" />
            REAP ORPHANED SESSIONS
            <span className="ml-auto text-[8px] font-mono uppercase text-neutral-500 border border-neutral-300 px-1.5 py-0.5 bg-neutral-100">
              Not Implemented
            </span>
          </div>
          <div className="p-4 flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <p className="text-[11px] font-mono text-neutral-600 leading-relaxed mb-2">
                Automatically detects and terminates orphaned sessions that have exceeded
                idle thresholds and have no active client connection.
              </p>
              <p className="text-[10px] font-mono text-neutral-500 leading-relaxed">
                Requires a backend endpoint that does not yet exist. Placeholder only.
              </p>
            </div>
            
            <div className="w-full md:w-64 bg-black text-white p-4 flex flex-col justify-between shrink-0">
              <div>
                <span className="text-[9px] font-mono text-neutral-400 block mb-1">TARGET TIMEOUT</span>
                <select disabled className="w-full bg-neutral-800 border-none text-white text-[11px] font-mono p-1.5 mb-4 focus:outline-none appearance-none">
                  <option>120 MINS</option>
                </select>
              </div>
              <button
                disabled
                className="w-full py-2 bg-white text-black font-bold uppercase text-[11px] font-mono disabled:opacity-50 cursor-not-allowed"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
