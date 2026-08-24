"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { OracleConfig } from "@/lib/types";

interface HeaderProps {
  config: OracleConfig;
  loading: boolean;
  onApplyPreset: (role: "sys" | "student") => void;
  onPingNode: () => void;
  onRescan: () => void;
}

export function Header({
  config,
  loading,
  onApplyPreset,
  onPingNode,
}: HeaderProps) {
  const connectTarget = `${config.host}:${config.port}/${config.serviceName}`;

  return (
    <header className="shrink-0 bg-white text-black border-b border-neutral-300">
      <div className="flex items-stretch justify-between h-12">
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 border-r border-neutral-300">
          <span className="text-sm font-bold uppercase tracking-tight font-sans">
            FACULTY_DB_CONSOLE // ORACLE 23C
          </span>
        </div>

        {/* Sub-label */}
        <div className="hidden lg:flex items-center px-4 border-r border-neutral-300 flex-1">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Automated Student Node Interventions
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-stretch">
          {/* Role preset toggles */}
          <div className="flex items-center gap-0 border-r border-neutral-300 px-3">
            <span className="text-[10px] text-neutral-500 uppercase font-mono mr-2">Role:</span>
            <button
              onClick={() => onApplyPreset("sys")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase font-mono border-y border-l transition-none ${
                config.user === "SYS"
                  ? "bg-black text-white border-black"
                  : "bg-transparent text-neutral-600 border-neutral-300 hover:text-black hover:border-neutral-500"
              }`}
            >
              SYSDBA
            </button>
            <button
              onClick={() => onApplyPreset("student")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase font-mono border transition-none ${
                config.user === "STUDENT"
                  ? "bg-black text-white border-black"
                  : "bg-transparent text-neutral-600 border-neutral-300 hover:text-black hover:border-neutral-500"
              }`}
            >
              STUDENT
            </button>
          </div>

          {/* Connection target */}
          <div className="flex items-center px-4 border-r border-neutral-300 gap-2">
            <span className="text-[10px] text-neutral-500 font-mono uppercase">Target:</span>
            <span className="text-[10px] font-mono text-neutral-900 font-bold">{connectTarget}</span>
          </div>

          {/* Ping */}
          <button
            onClick={onPingNode}
            disabled={loading}
            className="flex items-center gap-2 px-4 text-xs font-bold uppercase font-mono text-neutral-600 hover:text-black hover:bg-neutral-50 disabled:opacity-40 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wifi className="w-3.5 h-3.5" />
            )}
            <span className="text-[10px]">Ping Node</span>
          </button>
        </div>
      </div>
    </header>
  );
}
