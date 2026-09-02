"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { OracleConfig, DiscoveredNode, ActiveView, StatusMessage } from "@/lib/types";
import { fetchNodes } from "@/lib/nodes";
import { pingOracle } from "@/lib/oracle";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { SQLRunner } from "@/components/SQLRunner";
import { SchemaExplorer } from "@/components/SchemaExplorer";
import { ActiveSessions } from "@/components/ActiveSessions";
import { RescueTools } from "@/components/RescueTools";
import { StatusBar } from "@/components/StatusBar";
import { Overview } from "@/components/Overview";
import { DatabaseHealth } from "@/components/DatabaseHealth";
import { Evaluation } from "@/components/Evaluation";
import { AuditLog, type AuditEntry } from "@/components/AuditLog";

export default function FacultyDashboard() {
  // ── Node state ───────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<DiscoveredNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [nodesLoading, setNodesLoading] = useState(false);

  // ── Oracle connection config ───────────────────────────────────────────────
  const [config, setConfig] = useState<OracleConfig>({
    host: "127.0.0.1",
    port: 1522, // changed default to 1522
    serviceName: "FREEPDB1",
    user: "SYS",
    password: "LabDbPassword2026",
    asSysdba: true,
  });

  // ... (rest of state unchanged)

  // Node discovery
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
        // Set host from discovered node; keep port if discovery doesn't provide one
        setConfig((prev) => ({ ...prev, host: first.dbIp || first.ip }));
      }
    } finally {
      setNodesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  // handler that Header will call to apply a custom config patch
  const handleUpdateConfig = useCallback((patch: Partial<OracleConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // ... (rest unchanged)

  return (
    <div className="flex h-full overflow-hidden bg-[#f4f2ee]">
      {/* Sidebar etc. */}
      <div className="hidden md:block shrink-0">
        <Header
          config={config}
          loading={pingLoading}
          onApplyPreset={handleApplyPreset}
          onPingNode={handlePingNode}
          onRescan={loadNodes}
          onUpdateConfig={handleUpdateConfig} // new prop
        />
      </div>

      {/* mobile header */}
      <div className="md:hidden bg-black border-b border-neutral-800 px-3 py-2 shrink-0">
        {/* show compact info and ping controls (unchanged) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* role buttons etc. */}
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

      {/* rest of component unchanged */}
    </div>
  );
}
