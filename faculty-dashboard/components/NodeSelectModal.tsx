"use client";

import { useState } from "react";
import {
  Server,
  User,
  UserX,
  Search,
  CheckCircle2,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type { DiscoveredNode, StudentRecord } from "@/lib/types";

interface NodeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: DiscoveredNode[];
  selectedNodeId: string;
  students: StudentRecord[];
  nodesLoading: boolean;
  onRescan: () => void;
  onSelectNode: (node: DiscoveredNode) => void;
}

export function NodeSelectModal({
  isOpen,
  onClose,
  nodes,
  selectedNodeId,
  students,
  nodesLoading,
  onRescan,
  onSelectNode,
}: NodeSelectModalProps) {
  const [filter, setFilter] = useState<"ALL" | "OCCUPIED" | "UNOCCUPIED">("ALL");
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  // Find student occupant for a node
  const getOccupant = (node: DiscoveredNode): StudentRecord | undefined => {
    return students.find(
      (s) =>
        (s.targetNodeId && s.targetNodeId === node.id) ||
        (s.targetIp &&
          (s.targetIp === node.dbIp || s.targetIp === node.ip) &&
          (s.targetPort ? s.targetPort === node.dbPort : true))
    );
  };

  const nodesWithOccupancy = nodes.map((node) => {
    const occupant = getOccupant(node);
    return {
      node,
      occupant,
      isOccupied: Boolean(occupant),
    };
  });

  const filtered = nodesWithOccupancy.filter(({ node, occupant, isOccupied }) => {
    if (filter === "OCCUPIED" && !isOccupied) return false;
    if (filter === "UNOCCUPIED" && isOccupied) return false;

    if (!search) return true;
    const term = search.toLowerCase();
    return (
      node.hostname.toLowerCase().includes(term) ||
      (node.dbIp && node.dbIp.includes(term)) ||
      (occupant &&
        (occupant.name.toLowerCase().includes(term) ||
          occupant.regNo.toLowerCase().includes(term) ||
          (occupant.notes && occupant.notes.toLowerCase().includes(term))))
    );
  });

  const occupiedCount = nodesWithOccupancy.filter((n) => n.isOccupied).length;
  const unoccupiedCount = nodes.length - occupiedCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-300 shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] font-mono text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-neutral-300" />
            <div>
              <h2 className="font-bold text-sm tracking-wide">
                SELECT STUDENT LAB NODE
              </h2>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Lab seating status • Mapped Swarm Oracle Containers
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRescan}
              disabled={nodesLoading}
              title="Rescan Nodes"
              className="p-1.5 text-neutral-400 hover:text-white transition disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${nodesLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by Node, Student Name, Reg No, Seat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 bg-white focus:outline-none focus:border-black text-xs"
            />
          </div>

          <div className="flex items-center gap-1 self-stretch sm:self-auto">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 font-bold transition border ${
                filter === "ALL"
                  ? "bg-black text-white border-black"
                  : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100"
              }`}
            >
              ALL ({nodes.length})
            </button>
            <button
              onClick={() => setFilter("OCCUPIED")}
              className={`px-3 py-1.5 font-bold transition border flex items-center gap-1.5 ${
                filter === "OCCUPIED"
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-emerald-800 border-neutral-300 hover:bg-emerald-50"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              OCCUPIED ({occupiedCount})
            </button>
            <button
              onClick={() => setFilter("UNOCCUPIED")}
              className={`px-3 py-1.5 font-bold transition border flex items-center gap-1.5 ${
                filter === "UNOCCUPIED"
                  ? "bg-neutral-800 text-white border-neutral-800"
                  : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100"
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              VACANT ({unoccupiedCount})
            </button>
          </div>
        </div>

        {/* Nodes Grid / List */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-neutral-400">
              {nodesLoading ? "Scanning swarm for student nodes..." : "No matching nodes found."}
            </div>
          ) : (
            filtered.map(({ node, occupant, isOccupied }) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  onClick={() => {
                    onSelectNode(node);
                    onClose();
                  }}
                  className={`border p-3.5 cursor-pointer transition flex flex-col justify-between rounded-xs ${
                    isSelected
                      ? "border-black bg-neutral-100 shadow-sm ring-1 ring-black"
                      : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          node.dbStatus === "online" ? "bg-emerald-500" : "bg-neutral-400"
                        }`}
                      />
                      <span className="font-bold text-neutral-900 text-xs tracking-tight">
                        {node.hostname}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isOccupied ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <User className="w-3 h-3" />
                          OCCUPIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          <UserX className="w-3 h-3" />
                          VACANT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Student Details or Empty Notice */}
                  <div className="my-2.5 pt-2 border-t border-neutral-100">
                    {occupant ? (
                      <div>
                        <div className="font-bold text-neutral-900 flex items-center justify-between">
                          <span>{occupant.regNo}</span>
                          <span className="text-[10px] font-normal text-neutral-500">
                            {occupant.notes || "Lab Desk"}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-600 mt-0.5 truncate">
                          {occupant.name}
                        </div>
                        {occupant.email && (
                          <div className="text-[10px] text-neutral-400 truncate">
                            {occupant.email}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400 italic">
                        No student assigned to this node yet
                      </div>
                    )}
                  </div>

                  {/* Network / Connection details */}
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-100">
                    <span className="font-mono">
                      {node.dbIp || node.ip}:{node.dbPort || 1521}
                    </span>
                    {isSelected && (
                      <span className="font-bold text-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-black" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500">
            Total nodes online: <span className="font-bold text-neutral-800">{nodes.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white font-bold hover:bg-neutral-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
