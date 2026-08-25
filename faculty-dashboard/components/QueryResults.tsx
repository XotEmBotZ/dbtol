"use client";

import type { QueryResult } from "@/lib/types";

interface QueryResultsProps {
  result: QueryResult;
}

export function QueryResults({ result }: QueryResultsProps) {
  return (
    <div className="border border-neutral-300 mt-3 flex flex-col overflow-hidden">
      {/* Result meta bar */}
      <div className="bg-neutral-900 text-white px-3 py-1.5 text-[10px] font-mono flex items-center justify-between shrink-0">
        <span className="font-bold uppercase tracking-wide">
          RESULT SET
        </span>
        <div className="flex items-center gap-4">
          <span>
            <span className="text-neutral-500">ROWS:</span>{" "}
            <span className="text-white font-bold">{result.rows.length}</span>
          </span>
          <span>
            <span className="text-neutral-500">TIME:</span>{" "}
            <span className="text-white font-bold">{result.durationMs}ms</span>
          </span>
          {result.rowsAffected > 0 && result.rowsAffected !== result.rows.length && (
            <span>
              <span className="text-neutral-500">AFFECTED:</span>{" "}
              <span className="text-white font-bold">{result.rowsAffected}</span>
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-72">
        {result.rows.length > 0 ? (
          <table className="w-full text-[11px] font-mono border-collapse min-w-max">
            <thead className="sticky top-0 bg-neutral-100 border-b border-neutral-300">
              <tr>
                <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] text-neutral-500 border-r border-neutral-300 w-8 select-none">
                  #
                </th>
                {result.columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-2 py-1.5 text-left font-bold uppercase text-[10px] text-neutral-700 border-r border-neutral-300 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-neutral-200 hover:bg-neutral-50 even:bg-neutral-50/50"
                >
                  <td className="px-2 py-1 text-neutral-400 border-r border-neutral-200 select-none">
                    {rowIdx + 1}
                  </td>
                  {result.columns.map((col, colIdx) => {
                    const val = row[col];
                    const isNull = val === null || val === undefined;
                    return (
                      <td
                        key={colIdx}
                        className={`px-2 py-1 border-r border-neutral-200 whitespace-nowrap ${
                          isNull ? "text-neutral-400 italic" : "text-neutral-900"
                        }`}
                      >
                        {isNull ? "NULL" : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-3 py-4 text-[11px] font-mono text-neutral-500">
            0 rows returned.
          </div>
        )}
      </div>
    </div>
  );
}
