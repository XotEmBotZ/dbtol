"use client";

import { Activity, GraduationCap, UserCheck, History, Server, ChevronRight } from "lucide-react";
import type { DiscoveredNode, ActiveView, StudentRecord } from "@/lib/types";

interface SidebarProps {
  nodes: DiscoveredNode[];
  selectedNodeId: string;
  nodesLoading: boolean;
  activeView: ActiveView;
  students?: StudentRecord[];
  onOpenNodeModal: () => void;
  onNavigate: (view: ActiveView) => void;
}

const NAV_ITEMS: {
  id: ActiveView;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}[] = [
  { id: "evaluation", label: "EVALUATE STUDENTS", icon: GraduationCap },
  { id: "evaluations_history", label: "EVAL RECORDS", icon: History },
  { id: "students", label: "STUDENTS DIRECTORY", icon: UserCheck },
  { id: "health", label: "DB WORKSPACE", icon: Activity },
];

export function Sidebar({
  nodes,
  selectedNodeId,
  activeView,
  students = [],
  onOpenNodeModal,
  onNavigate,
}: SidebarProps) {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedOccupant = selectedNode
    ? students.find(
        (s) =>
          (s.targetNodeId && s.targetNodeId === selectedNode.id) ||
          (s.targetIp &&
            (s.targetIp === selectedNode.dbIp || s.targetIp === selectedNode.ip) &&
            (s.targetPort ? s.targetPort === selectedNode.dbPort : true))
      )
    : undefined;

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-neutral-950 border-r border-neutral-800 overflow-hidden h-full">
      {/* Active Node Selection Tile */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-900/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono">
            ACTIVE TARGET NODE
          </span>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {nodes.length} ONLINE
          </span>
        </div>

        <button
          onClick={onOpenNodeModal}
          className="w-full text-left p-2.5 bg-black border border-neutral-700 hover:border-neutral-500 transition group flex items-center justify-between"
        >
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
              <span className="font-mono text-xs font-bold text-white truncate">
                {selectedNode ? selectedNode.hostname : "No Node Selected"}
              </span>
            </div>
            {selectedOccupant ? (
              <div className="text-[10px] font-mono text-emerald-400 truncate mt-1">
                Occupant: {selectedOccupant.regNo} ({selectedOccupant.name.split(" ")[0]})
              </div>
            ) : (
              <div className="text-[10px] font-mono text-neutral-500 italic mt-1">
                Seat Vacant / Unassigned
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white shrink-0" />
        </button>

        <button
          onClick={onOpenNodeModal}
          className="w-full mt-2 py-1.5 px-2 text-[10px] font-mono font-bold uppercase tracking-wider bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white transition text-center"
        >
          Select Node Modal ↗
        </button>
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
                  isActive
                    ? "border-white text-white bg-neutral-900"
                    : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                } ${item.disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-neutral-500"}`} />
                <span className="font-mono text-[11px] tracking-normal font-semibold truncate">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
