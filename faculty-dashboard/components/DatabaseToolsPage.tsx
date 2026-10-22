"use client";

import { useState, useRef } from "react";
import { Activity, Database, Terminal, Users } from "lucide-react";
import type { OracleConfig, DiscoveredNode } from "@/lib/types";
import { DatabaseHealth } from "@/components/DatabaseHealth";
import { SchemaExplorer } from "@/components/SchemaExplorer";
import { SQLRunner } from "@/components/SQLRunner";
import { ActiveSessions } from "@/components/ActiveSessions";

interface DatabaseToolsPageProps {
  config: OracleConfig;
  selectedNode?: DiscoveredNode;
}

type DbSubTab = "health" | "schema" | "sql" | "sessions";

export function DatabaseToolsPage({ config, selectedNode }: DatabaseToolsPageProps) {
  const [subTab, setSubTab] = useState<DbSubTab>("health");
  const [pendingSql, setPendingSql] = useState<string | undefined>(undefined);
  const sqlRunnerKey = useRef(0);

  const handleQueryTable = (sql: string) => {
    sqlRunnerKey.current += 1;
    setPendingSql(sql);
    setSubTab("sql");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Sub navigation tabs */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-neutral-100 border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-1 font-mono text-xs">
          <button
            onClick={() => {
              setPendingSql(undefined);
              setSubTab("health");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold transition border ${
              subTab === "health"
                ? "bg-white text-black border-neutral-300 shadow-sm"
                : "bg-transparent text-neutral-600 border-transparent hover:text-black"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            HEALTH
          </button>

          <button
            onClick={() => {
              setPendingSql(undefined);
              setSubTab("schema");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold transition border ${
              subTab === "schema"
                ? "bg-white text-black border-neutral-300 shadow-sm"
                : "bg-transparent text-neutral-600 border-transparent hover:text-black"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            SCHEMA EXPLORER
          </button>

          <button
            onClick={() => setSubTab("sql")}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold transition border ${
              subTab === "sql"
                ? "bg-white text-black border-neutral-300 shadow-sm"
                : "bg-transparent text-neutral-600 border-transparent hover:text-black"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            SQL RUNNER
          </button>

          <button
            onClick={() => {
              setPendingSql(undefined);
              setSubTab("sessions");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold transition border ${
              subTab === "sessions"
                ? "bg-white text-black border-neutral-300 shadow-sm"
                : "bg-transparent text-neutral-600 border-transparent hover:text-black"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            SESSIONS
          </button>
        </div>

        {selectedNode && (
          <div className="text-[11px] font-mono text-neutral-500">
            Node: <span className="font-bold text-neutral-800">{selectedNode.hostname}</span> ({config.host}:{config.port})
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {subTab === "health" && (
          <DatabaseHealth config={config} node={selectedNode} />
        )}
        {subTab === "schema" && (
          <SchemaExplorer
            key={`schema-${config.host}`}
            config={config}
            onQueryTable={handleQueryTable}
          />
        )}
        {subTab === "sql" && (
          <SQLRunner
            key={`sql-${sqlRunnerKey.current}-${config.host}`}
            config={config}
            initialQuery={pendingSql}
          />
        )}
        {subTab === "sessions" && (
          <ActiveSessions
            key={`sessions-${config.host}`}
            config={config}
          />
        )}
      </div>
    </div>
  );
}
