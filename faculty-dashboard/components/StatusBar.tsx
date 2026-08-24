"use client";

import { CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import type { StatusMessage } from "@/lib/types";

interface StatusBarProps {
  status: StatusMessage;
  className?: string;
}

export function StatusBar({ status, className = "" }: StatusBarProps) {
  const type = status.type ?? (status.ok ? "success" : "error");

  const variants = {
    success: {
      bar: "border-l-2 border-green-500 bg-green-950/40 text-green-300",
      icon: <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />,
      label: "OK",
      labelClass: "text-green-500",
    },
    error: {
      bar: "border-l-2 border-red-500 bg-red-950/30 text-red-300",
      icon: <XCircle className="w-3 h-3 text-red-400 shrink-0" />,
      label: "ERR",
      labelClass: "text-red-500",
    },
    loading: {
      bar: "border-l-2 border-blue-500 bg-blue-950/30 text-blue-300",
      icon: <Loader2 className="w-3 h-3 text-blue-400 shrink-0 animate-spin" />,
      label: "WAIT",
      labelClass: "text-blue-500",
    },
    info: {
      bar: "border-l-2 border-neutral-400 bg-neutral-800/50 text-neutral-300",
      icon: <Info className="w-3 h-3 text-neutral-400 shrink-0" />,
      label: "INFO",
      labelClass: "text-neutral-400",
    },
  };

  const v = variants[type];

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-mono ${v.bar} ${className}`}>
      {v.icon}
      <span className={`font-bold uppercase ${v.labelClass}`}>[{v.label}]</span>
      <span className="flex-1 truncate">{status.text}</span>
      {status.code && (
        <span className="font-bold uppercase text-red-400 shrink-0 border border-red-500/30 px-1 ml-2">
          CODE: {status.code}
        </span>
      )}
    </div>
  );
}
