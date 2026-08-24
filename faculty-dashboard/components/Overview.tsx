"use client";
import type { DiscoveredNode } from "@/lib/types";

export function Overview({ nodes }: { nodes: DiscoveredNode[] }) {
  const studentNodes = nodes.filter(n => n.role === "worker");
  const readyNodes = studentNodes.filter(n => n.status === "ready");
  const downNodes = studentNodes.filter(n => n.status === "down" || n.status === "unknown");

  const onlineDbs = studentNodes.filter(n => n.dbStatus === "online");
  const offlineDbs = studentNodes.filter(n => n.dbStatus !== "online");

  return (
    <div className="flex flex-col h-full bg-white p-8 overflow-auto">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-sans font-bold tracking-widest uppercase text-neutral-900 border-b-4 border-black pb-2 mb-8 inline-block pr-8">
          FACULTY DATABASE CONTROL
        </h1>

        <div className="bg-neutral-50 border border-neutral-300 p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-6 font-mono">
            LAB STATUS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 font-mono">
            <div>
              <div className="flex justify-between items-end border-b border-neutral-300 pb-2 mb-3">
                <span className="text-[11px] font-bold uppercase text-neutral-700">STUDENT NODES</span>
                <span className="text-2xl font-bold leading-none">{studentNodes.length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-green-600 mb-1">
                <span>READY</span>
                <span className="font-bold">{readyNodes.length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-red-600">
                <span>DOWN</span>
                <span className="font-bold">{downNodes.length}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end border-b border-neutral-300 pb-2 mb-3">
                <span className="text-[11px] font-bold uppercase text-neutral-700">DATABASES</span>
                <span className="text-2xl font-bold leading-none">{onlineDbs.length + offlineDbs.length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-green-600 mb-1">
                <span>ONLINE</span>
                <span className="font-bold">{onlineDbs.length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-red-600">
                <span>OFFLINE</span>
                <span className="font-bold">{offlineDbs.length}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end border-b border-neutral-300 pb-2 mb-3">
                <span className="text-[11px] font-bold uppercase text-neutral-700">ACTIVE SESSIONS</span>
              </div>
              <div className="flex justify-center items-center h-10 text-neutral-400">
                <span className="text-xl">-</span>
              </div>
              <div className="text-center text-[9px] text-neutral-400 mt-2 uppercase">
                Metrics require active polling
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}