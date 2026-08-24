"use client";
import { Shield } from "lucide-react";

export interface AuditEntry {
  time: string;
  action: string;
  target: string;
  result: string;
}

interface AuditLogProps {
  logs: AuditEntry[];
}

export function AuditLog({ logs }: AuditLogProps) {
  return (
    <div className="p-8 bg-white h-full overflow-auto">
      <div className="max-w-4xl">
        <div className="mb-8 flex items-center justify-between border-b-2 border-black pb-2">
          <h1 className="text-2xl font-sans font-bold tracking-widest uppercase text-neutral-900 inline-flex items-center gap-2">
            <Shield className="w-5 h-5" />
            LOCAL SESSION AUDIT
          </h1>
          <span className="font-mono text-[9px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-2 py-0.5 font-bold uppercase">
            NOT PERSISTED
          </span>
        </div>
        <div className="border border-neutral-300 bg-white">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-neutral-900 text-white uppercase text-[9px] tracking-wider">
              <tr>
                <th className="p-3 font-bold">TIME</th>
                <th className="p-3 font-bold">ACTION</th>
                <th className="p-3 font-bold">TARGET</th>
                <th className="p-3 font-bold">RESULT</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-neutral-400 uppercase text-[10px]">
                    No actions logged in this session
                  </td>
                </tr>
              ) : (
                logs.map((l, i) => (
                  <tr key={i} className="border-t border-neutral-200 hover:bg-neutral-50 transition-colors">
                    <td className="p-3 text-neutral-500">{new Date(l.time).toLocaleTimeString()}</td>
                    <td className="p-3 font-bold text-neutral-800">{l.action}</td>
                    <td className="p-3 text-neutral-600">{l.target}</td>
                    <td className={`p-3 font-bold ${l.result.includes("SUCCESS") || l.result.includes("OK") ? "text-green-600" : "text-red-600"}`}>
                      {l.result}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}