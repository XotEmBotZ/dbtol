"use client";

import { useState } from "react";
import { Wifi, Loader2, Edit, Check, X } from "lucide-react";
import type { OracleConfig } from "@/lib/types";

interface HeaderProps {
  config: OracleConfig;
  loading: boolean;
  onApplyPreset: (role: "sys" | "student") => void;
  onPingNode: () => void;
  onRescan: () => void;
  onUpdateConfig: (patch: Partial<OracleConfig>) => void;
}

export function Header({
  config,
  loading,
  onApplyPreset,
  onPingNode,
  onRescan,
  onUpdateConfig,
}: HeaderProps) {
  const connectTarget = `${config.host}:${config.port}/${config.serviceName}`;

  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState({
    host: config.host || "",
    port: String(config.port || 1522),
    user: config.user || "",
    password: config.password || "",
    serviceName: config.serviceName || "",
  });

  function openEditor() {
    setTmp({
      host: config.host || "",
      port: String(config.port || 1522),
      user: config.user || "",
      password: config.password || "",
      serviceName: config.serviceName || "",
    });
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    const patch: Partial<OracleConfig> = {
      host: tmp.host.trim(),
      port: Number(tmp.port) || 1522,
      user: tmp.user,
      password: tmp.password,
      serviceName: tmp.serviceName || config.serviceName,
    };
    onUpdateConfig(patch);
    setEditing(false);
  }

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

          {/* Connection target or editor */}
          <div className="flex items-center px-4 border-r border-neutral-300 gap-2">
            {!editing ? (
              <>
                <span className="text-[10px] text-neutral-500 font-mono uppercase">Target:</span>
                <span className="text-[10px] font-mono text-neutral-900 font-bold">{connectTarget}</span>
                <button
                  title="Edit connection"
                  onClick={openEditor}
                  className="ml-3 p-1 text-neutral-600 hover:text-black"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="text-[11px] font-mono border px-2 py-1 rounded w-36"
                  value={tmp.host}
                  onChange={(e) => setTmp((s) => ({ ...s, host: e.target.value }))}
                  placeholder="host"
                />
                <input
                  className="text-[11px] font-mono border px-2 py-1 rounded w-20"
                  value={tmp.port}
                  onChange={(e) => setTmp((s) => ({ ...s, port: e.target.value }))}
                  placeholder="port"
                />
                <input
                  className="text-[11px] font-mono border px-2 py-1 rounded w-28"
                  value={tmp.user}
                  onChange={(e) => setTmp((s) => ({ ...s, user: e.target.value }))}
                  placeholder="user"
                />
                <input
                  className="text-[11px] font-mono border px-2 py-1 rounded w-36"
                  value={tmp.password}
                  onChange={(e) => setTmp((s) => ({ ...s, password: e.target.value }))}
                  placeholder="password"
                  type="password"
                />
                <button onClick={save} className="p-1 text-green-700" title="Save">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancel} className="p-1 text-neutral-600" title="Cancel">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Ping and rescan */}
          <div className="flex items-center">
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

            <button
              onClick={onRescan}
              className="px-3 text-[10px] text-neutral-600 hover:text-black"
              title="Rescan cluster"
            >
              Rescan
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
