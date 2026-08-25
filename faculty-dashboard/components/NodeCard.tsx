"use client";

import type { DiscoveredNode } from "@/lib/types";

interface NodeCardProps {
  node: DiscoveredNode;
  isSelected: boolean;
  onClick: () => void;
}

export function NodeCard({ node, isSelected, onClick }: NodeCardProps) {
  const nodeStatusColor =
    node.status === "ready"
      ? "text-green-500"
      : node.status === "down"
      ? "text-red-500"
      : "text-yellow-500";

  const dbStatusColor = 
    node.dbStatus === "online" 
      ? "text-green-500" 
      : node.dbStatus === "offline" 
      ? "text-red-500" 
      : "text-yellow-500";

  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col text-left p-2.5 border transition-none font-mono ${
        isSelected
          ? "bg-white text-black border-white shadow-sm"
          : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500 hover:text-white"
      }`}
    >
      <div className={`text-[11px] font-bold truncate uppercase tracking-wider mb-1 ${
        isSelected ? "text-black" : "text-white"
      }`}>
        {node.hostname}
      </div>
      
      <div className={`text-[10px] mb-2 ${
        isSelected ? "text-neutral-600" : "text-neutral-400"
      }`}>
        {node.ip}
      </div>
      
      <div className={`text-[9px] uppercase font-bold tracking-wide mb-1.5 ${
        isSelected ? "text-neutral-500" : "text-neutral-500"
      }`}>
        {node.role}
      </div>
      
      <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wide mb-1">
        <span className={nodeStatusColor}>●</span>
        <span className={isSelected ? "text-neutral-700" : "text-neutral-300"}>{node.status}</span>
      </div>
      
      <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wide">
        <span className={isSelected ? "text-neutral-500" : "text-neutral-500"}>DATABASE</span>
        <span className={dbStatusColor}>{node.dbStatus === "online" ? "●" : "×"}</span>
        <span className={isSelected ? "text-neutral-700" : "text-neutral-300"}>{node.dbStatus || "UNKNOWN"}</span>
      </div>
    </button>
  );
}
