"use client";

import { RefreshCw, LayoutDashboard, Activity, Terminal, Database, Users, GraduationCap } from "lucide-react";
import type { DiscoveredNode, ActiveView } from "@/lib/types";
import { NodeCard } from "@/components/NodeCard";

interface SidebarProps {
  nodes: DiscoveredNode[];
  selectedNodeId: string;
  nodesLoading: boolean;
  activeView: ActiveView;
  onSelectNode: (node: DiscoveredNode) => void;
  onRescan: () => void;
  onNavigate: (view: ActiveView) => void;
}

const NAV_ITEMS: {
  id: ActiveView;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}[] = [
  { id: "overview", label: "OVERVIEW", icon: LayoutDashboard },
  { id: "health", label: "HEALTH", icon: Activity },
  { id: "schema", label: "SCHEMA", icon: Database },
  { id: "sql", label: "SQL RUNNER", icon: Terminal },
  { id: "sessions", label: "SESSIONS", icon: Users },
  { id: "evaluation", label: "EVALUATION", icon: GraduationCap },
];

export function Sidebar({
  nodes,
  selectedNodeId,
  nodesLoading,
  activeView,
  onSelectNode,
  onRescan,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 flex flex-col bg-neutral-950 border-r border-neutral-800 overflow-hidden h-full">
      {/* Node Section Header */}
      <div className="px-3 pt-3 pb-2 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono">
            [SWARM_STUDENT_NODES]
          </span>
          <button
            onClick={onRescan}
            disabled={nodesLoading}
            title="Rescan Swarm"
            className="p-1 text-neutral-500 hover:text-white disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${nodesLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Node List */}
      <div className="overflow-y-auto border-b border-neutral-800" style={{ maxHeight: "52%" }}>
        {nodes.length === 0 && !nodesLoading && (
          <div className="px-3 py-4 text-[10px] text-neutral-600 font-mono uppercase">
            No nodes discovered.
          </div>
        )}
        {nodesLoading && (
          <div className="px-3 py-4 text-[10px] text-neutral-600 font-mono uppercase animate-pulse">
            Scanning swarm...
          </div>
        )}
        <div className="p-2 space-y-1">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              isSelected={node.id === selectedNodeId}
              onClick={() => onSelectNode(node)}
            />
          ))}
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 font-mono">
            WORKSPACE
          </span>
        </div>
        <nav className="px-2 pb-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = !item.disabled && item.id === activeView;
            return (
              <button
                key={item.id}
                onClick={() =>
                  !item.disabled && onNavigate(item.id as ActiveView)
                }
                disabled={item.disabled}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-sans font-medium tracking-wide transition-none border-l-2 mb-0.5 ${
                  item.disabled
                    ? "text-neutral-700 border-transparent cursor-not-allowed"
                    : isActive
                    ? "text-white border-white bg-neutral-800"
                    : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.disabled && (
                  <span className="ml-auto text-[8px] text-neutral-700 uppercase">
                    N/A
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-neutral-800">
        <span className="text-[9px] text-neutral-700 font-mono uppercase">
          dbtol // oracle 23c
        </span>
      </div>
    </aside>
  );
}
