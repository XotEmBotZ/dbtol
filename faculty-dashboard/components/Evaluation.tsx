"use client";

import { useState } from "react";
import {
  GraduationCap,
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  TableProperties,
  Key,
  Link2,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileCheck,
  Users,
  Copy,
  Check,
} from "lucide-react";
import type { OracleConfig, DiscoveredNode, BenchmarkConfig, BenchmarkTableRule } from "@/lib/types";
import { getTables, getTableSchema, runQuery } from "@/lib/oracle";

interface EvaluationProps {
  config: OracleConfig;
  node: DiscoveredNode | undefined;
  nodes?: DiscoveredNode[];
}

interface ItemCheckResult {
  category: "table" | "column" | "pk" | "fk" | "constraint" | "data";
  title: string;
  passed: boolean;
  message?: string;
  points: number;
  earned: number;
}

interface NodeEvaluationResult {
  nodeId: string;
  hostname: string;
  ip: string;
  dbIp: string;
  dbPort: number;
  totalPoints: number;
  earnedPoints: number;
  scorePercentage: number;
  status: "PASSED" | "PARTIAL" | "FAILED" | "ERROR";
  errorMessage?: string;
  checks: ItemCheckResult[];
}

export function Evaluation({ config, node, nodes = [] }: EvaluationProps) {
  // ── Benchmark state ────────────────────────────────────────────────────────
  const [benchmark, setBenchmark] = useState<BenchmarkConfig | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [showConfigJson, setShowConfigJson] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Evaluation execution state ─────────────────────────────────────────────
  const [targetScope, setTargetScope] = useState<"selected" | "all">("selected");
  const [evaluating, setEvaluating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; nodeName: string } | null>(null);
  const [results, setResults] = useState<NodeEvaluationResult[] | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // ── 1. Capture Benchmark Schema from Database ───────────────────────────────
  const captureBenchmarkFromDb = async () => {
    if (!node) return;
    setCapturing(true);
    setCaptureStatus(`Connecting to ${node.hostname} (${node.dbIp || node.ip})...`);

    try {
      const sourceConfig: OracleConfig = {
        ...config,
        host: node.dbIp || node.ip,
        port: node.dbPort || config.port,
      };

      setCaptureStatus("Fetching table catalog...");
      const tablesResp = await getTables(sourceConfig);
      if (!tablesResp.ok || !tablesResp.tables || tablesResp.tables.length === 0) {
        setCaptureStatus(`Failed: ${tablesResp.error || "No tables found in schema"}`);
        setCapturing(false);
        return;
      }

      const tableRules: BenchmarkTableRule[] = [];

      for (let i = 0; i < tablesResp.tables.length; i++) {
        const t = tablesResp.tables[i];
        setCaptureStatus(`Analyzing schema for ${t.TABLE_NAME} (${i + 1}/${tablesResp.tables.length})...`);
        const schemaResp = await getTableSchema(sourceConfig, t.TABLE_NAME);

        if (schemaResp.ok && schemaResp.schema) {
          const s = schemaResp.schema;

          // Map columns
          const cols = s.columns.map((c) => ({
            name: c.COLUMN_NAME,
            type: c.DATA_TYPE,
            nullable: c.NULLABLE === "Y",
          }));

          // Map constraints (deduplicating by name)
          const seenCons = new Set<string>();
          const cons: BenchmarkTableRule["constraints"] = [];
          for (const c of s.constraints) {
            if (!seenCons.has(c.CONSTRAINT_NAME)) {
              seenCons.add(c.CONSTRAINT_NAME);
              cons.push({
                name: c.CONSTRAINT_NAME,
                type: c.CONSTRAINT_TYPE,
                column: c.COLUMN_NAME,
                rTable: c.R_TABLE_NAME,
                condition: c.SEARCH_CONDITION,
              });
            }
          }

          tableRules.push({
            tableName: t.TABLE_NAME,
            columns: cols,
            constraints: cons,
            requireData: true,
          });
        }
      }

      const newBenchmark: BenchmarkConfig = {
        name: `Benchmark from ${node.hostname}`,
        sourceNode: node.hostname,
        capturedAt: new Date().toLocaleString(),
        tables: tableRules,
      };

      setBenchmark(newBenchmark);
      setCaptureStatus(`Successfully captured ${tableRules.length} tables from ${node.hostname}`);
    } catch (err: any) {
      setCaptureStatus(`Capture error: ${err.message || String(err)}`);
    } finally {
      setCapturing(false);
    }
  };

  // ── 2. Evaluate a Single Node against Benchmark ────────────────────────────
  const evaluateSingleNode = async (
    targetNode: DiscoveredNode,
    bench: BenchmarkConfig
  ): Promise<NodeEvaluationResult> => {
    const checks: ItemCheckResult[] = [];
    const targetConfig: OracleConfig = {
      ...config,
      host: targetNode.dbIp || targetNode.ip,
      port: targetNode.dbPort || config.port,
    };

    try {
      // Step 1: Fetch target tables
      const tablesResp = await getTables(targetConfig);
      if (!tablesResp.ok || !tablesResp.tables) {
        return {
          nodeId: targetNode.id,
          hostname: targetNode.hostname,
          ip: targetNode.ip,
          dbIp: targetNode.dbIp || targetNode.ip,
          dbPort: targetNode.dbPort || config.port,
          totalPoints: 100,
          earnedPoints: 0,
          scorePercentage: 0,
          status: "ERROR",
          errorMessage: tablesResp.error || "Could not connect to target database",
          checks: [],
        };
      }

      const targetTableNames = new Set(tablesResp.tables.map((t) => t.TABLE_NAME.toUpperCase()));

      // Step 2: Evaluate each benchmark table
      for (const expectedTable of bench.tables) {
        const tName = expectedTable.tableName.toUpperCase();
        const tableExists = targetTableNames.has(tName);

        // 2a. Table Existence check
        checks.push({
          category: "table",
          title: `Table '${tName}' Exists`,
          passed: tableExists,
          message: tableExists ? "Table present" : `Missing table '${tName}'`,
          points: 10,
          earned: tableExists ? 10 : 0,
        });

        if (!tableExists) {
          // If table doesn't exist, fail subsequent column and constraint checks for this table
          for (const col of expectedTable.columns) {
            checks.push({
              category: "column",
              title: `${tName}.${col.name} (${col.type})`,
              passed: false,
              message: "Table missing",
              points: 2,
              earned: 0,
            });
          }
          for (const cons of expectedTable.constraints) {
            checks.push({
              category: cons.type === "P" ? "pk" : cons.type === "R" ? "fk" : "constraint",
              title: `${tName} ${getConstraintLabel(cons.type)} ${cons.column || ""}`,
              passed: false,
              message: "Table missing",
              points: 5,
              earned: 0,
            });
          }
          if (expectedTable.requireData) {
            checks.push({
              category: "data",
              title: `${tName} Row Data Populated`,
              passed: false,
              message: "Table missing",
              points: 5,
              earned: 0,
            });
          }
          continue;
        }

        // Fetch target table schema
        const targetSchemaResp = await getTableSchema(targetConfig, tName);
        const targetCols = targetSchemaResp.ok && targetSchemaResp.schema ? targetSchemaResp.schema.columns : [];
        const targetCons = targetSchemaResp.ok && targetSchemaResp.schema ? targetSchemaResp.schema.constraints : [];

        const targetColMap = new Map(targetCols.map((c) => [c.COLUMN_NAME.toUpperCase(), c]));

        // 2b. Check Columns & Types
        for (const col of expectedTable.columns) {
          const targetCol = targetColMap.get(col.name.toUpperCase());
          const passed = !!targetCol;
          checks.push({
            category: "column",
            title: `${tName}.${col.name} (${col.type})`,
            passed,
            message: passed
              ? `Column found (${targetCol?.DATA_TYPE})`
              : `Missing column '${col.name}' in '${tName}'`,
            points: 2,
            earned: passed ? 2 : 0,
          });
        }

        // 2c. Check Constraints
        for (const cons of expectedTable.constraints) {
          let passed = false;
          let message = "";

          if (cons.type === "P") {
            // Primary Key check
            const pk = targetCons.find((c) => c.CONSTRAINT_TYPE === "P");
            passed = !!pk && (!cons.column || pk.COLUMN_NAME?.toUpperCase() === cons.column.toUpperCase());
            message = passed ? `Primary key verified on ${pk?.COLUMN_NAME || "column"}` : `Missing Primary Key on '${tName}'`;
          } else if (cons.type === "R") {
            // Foreign Key check
            const fk = targetCons.find(
              (c) =>
                c.CONSTRAINT_TYPE === "R" &&
                (!cons.column || c.COLUMN_NAME?.toUpperCase() === cons.column.toUpperCase()) &&
                (!cons.rTable || c.R_TABLE_NAME?.toUpperCase() === cons.rTable.toUpperCase())
            );
            passed = !!fk;
            message = passed
              ? `Foreign key verified $\to$ ${fk?.R_TABLE_NAME || "referenced table"}`
              : `Missing Foreign Key referencing '${cons.rTable || "table"}' on '${cons.column || "column"}'`;
          } else if (cons.type === "U") {
            // Unique check
            const uq = targetCons.find(
              (c) => c.CONSTRAINT_TYPE === "U" && (!cons.column || c.COLUMN_NAME?.toUpperCase() === cons.column.toUpperCase())
            );
            passed = !!uq;
            message = passed ? "Unique constraint verified" : `Missing UNIQUE constraint on '${cons.column || "column"}'`;
          } else {
            // Check constraint
            const ck = targetCons.find((c) => c.CONSTRAINT_TYPE === "C" && (!cons.column || c.COLUMN_NAME?.toUpperCase() === cons.column.toUpperCase()));
            passed = !!ck;
            message = passed ? "Check constraint verified" : `Missing CHECK constraint on '${cons.column || "column"}'`;
          }

          checks.push({
            category: cons.type === "P" ? "pk" : cons.type === "R" ? "fk" : "constraint",
            title: `${tName} ${getConstraintLabel(cons.type)} (${cons.column || cons.name})`,
            passed,
            message,
            points: 5,
            earned: passed ? 5 : 0,
          });
        }

        // 2d. Check Data Population
        if (expectedTable.requireData) {
          const countQuery = await runQuery(targetConfig, `SELECT COUNT(*) as CNT FROM ${targetConfig.user || "STUDENT"}.${tName}`);
          const rowCount = countQuery.ok && countQuery.result?.rows?.[0] ? Number((countQuery.result.rows[0] as any).CNT) : 0;
          const passed = rowCount > 0;
          checks.push({
            category: "data",
            title: `${tName} Contains Data Rows`,
            passed,
            message: passed ? `${rowCount} rows found` : `Table is empty (0 rows)`,
            points: 5,
            earned: passed ? 5 : 0,
          });
        }
      }

      const totalPoints = checks.reduce((acc, c) => acc + c.points, 0);
      const earnedPoints = checks.reduce((acc, c) => acc + c.earned, 0);
      const scorePercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

      const status: NodeEvaluationResult["status"] =
        scorePercentage === 100 ? "PASSED" : scorePercentage >= 50 ? "PARTIAL" : "FAILED";

      return {
        nodeId: targetNode.id,
        hostname: targetNode.hostname,
        ip: targetNode.ip,
        dbIp: targetNode.dbIp || targetNode.ip,
        dbPort: targetNode.dbPort || config.port,
        totalPoints,
        earnedPoints,
        scorePercentage,
        status,
        checks,
      };
    } catch (err: any) {
      return {
        nodeId: targetNode.id,
        hostname: targetNode.hostname,
        ip: targetNode.ip,
        dbIp: targetNode.dbIp || targetNode.ip,
        dbPort: targetNode.dbPort || config.port,
        totalPoints: 100,
        earnedPoints: 0,
        scorePercentage: 0,
        status: "ERROR",
        errorMessage: err.message || "Evaluation encountered an unexpected error",
        checks: [],
      };
    }
  };

  // ── 3. Run Batch Evaluation ────────────────────────────────────────────────
  const handleRunEvaluation = async () => {
    if (!benchmark) return;

    setEvaluating(true);
    setResults(null);

    const targetNodesList: DiscoveredNode[] =
      targetScope === "selected" && node
        ? [node]
        : nodes.length > 0
        ? nodes
        : node
        ? [node]
        : [];

    if (targetNodesList.length === 0) {
      setEvaluating(false);
      return;
    }

    const evaluationResults: NodeEvaluationResult[] = [];

    for (let i = 0; i < targetNodesList.length; i++) {
      const targetNode = targetNodesList[i];
      setProgress({
        current: i + 1,
        total: targetNodesList.length,
        nodeName: targetNode.hostname,
      });

      const res = await evaluateSingleNode(targetNode, benchmark);
      evaluationResults.push(res);
    }

    setResults(evaluationResults);
    setEvaluating(false);
    setProgress(null);
  };

  const getConstraintLabel = (type: string) => {
    switch (type) {
      case "P":
        return "PRIMARY KEY";
      case "R":
        return "FOREIGN KEY";
      case "U":
        return "UNIQUE";
      case "C":
        return "CHECK";
      default:
        return "CONSTRAINT";
    }
  };

  const handleCopyJson = () => {
    if (!benchmark) return;
    navigator.clipboard.writeText(JSON.stringify(benchmark, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 bg-white h-full overflow-auto font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-sans font-bold tracking-widest uppercase text-neutral-900 inline-flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-black" />
              SCHEMA EVALUATOR & BENCHMARK
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Extract ground-truth schema from a reference database and validate student instances automatically.
            </p>
          </div>
        </div>

        {/* Step 1: Benchmark Configuration Source */}
        <div className="border border-neutral-300 bg-neutral-50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">STEP 1</span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                Ground Truth Benchmark Schema
              </h2>
            </div>
            {benchmark && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfigJson(!showConfigJson)}
                  className="px-2.5 py-1 text-[10px] uppercase font-bold border border-neutral-300 bg-white hover:bg-neutral-100"
                >
                  {showConfigJson ? "Hide JSON" : "View JSON"}
                </button>
                <button
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 text-[10px] uppercase font-bold border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex-1 bg-white border border-neutral-300 p-3 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-bold uppercase text-neutral-500">Reference Source DB</div>
                <div className="text-xs font-bold text-neutral-900">
                  {node ? `${node.hostname} (${node.dbIp || node.ip}:${node.dbPort || config.port})` : "NO NODE SELECTED"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase text-neutral-500">Status</div>
                <div className="text-xs font-bold text-blue-700">
                  {benchmark ? `${benchmark.tables.length} Tables Loaded` : "No Benchmark Set"}
                </div>
              </div>
            </div>

            <button
              onClick={captureBenchmarkFromDb}
              disabled={capturing || !node}
              className="px-4 py-3 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold uppercase text-[11px] flex items-center justify-center gap-2 shrink-0 transition-none"
            >
              {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-400" />}
              Capture Benchmark from This DB
            </button>
          </div>

          {captureStatus && (
            <div className="mt-3 text-[11px] text-neutral-600 bg-white p-2 border border-neutral-200 flex items-center gap-2">
              <RefreshCw className={`w-3 h-3 ${capturing ? "animate-spin" : ""}`} />
              {captureStatus}
            </div>
          )}

          {/* Expandable Benchmark Config Inspection */}
          {benchmark && !showConfigJson && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="text-[10px] font-bold uppercase text-neutral-500 mb-2">
                Captured Tables & Rules ({benchmark.tables.length}):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {benchmark.tables.map((t, idx) => (
                  <div key={idx} className="bg-white p-3 border border-neutral-200 text-xs">
                    <div className="font-bold text-neutral-900 flex items-center justify-between border-b border-neutral-100 pb-1 mb-2">
                      <span className="flex items-center gap-1.5">
                        <TableProperties className="w-3.5 h-3.5 text-blue-600" /> {t.tableName}
                      </span>
                      <span className="text-[9px] text-neutral-400 font-normal">
                        {t.columns.length} cols | {t.constraints.length} cons
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-600 space-y-1">
                      <div>
                        <span className="font-bold text-neutral-500">Columns:</span> {t.columns.map((c) => c.name).join(", ")}
                      </div>
                      <div>
                        <span className="font-bold text-neutral-500">Constraints:</span>{" "}
                        {t.constraints.map((c) => `${getConstraintLabel(c.type)} (${c.column || c.name})`).join(", ") || "None"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {benchmark && showConfigJson && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <pre className="bg-neutral-900 text-neutral-100 p-4 text-[10px] overflow-auto max-h-60">
                {JSON.stringify(benchmark, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Step 2: Evaluation Execution */}
        <div className="border border-neutral-300 bg-neutral-50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">STEP 2</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              Run Evaluation Against Target Databases
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label
              onClick={() => setTargetScope("selected")}
              className={`p-4 border cursor-pointer flex items-center justify-between transition-none ${
                targetScope === "selected" ? "bg-white border-black shadow-sm" : "bg-neutral-100 border-neutral-300 text-neutral-500"
              }`}
            >
              <div>
                <div className="font-bold text-xs uppercase text-neutral-900">Current Selected Node Only</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {node ? `${node.hostname} (${node.dbIp || node.ip})` : "None"}
                </div>
              </div>
              <input type="radio" checked={targetScope === "selected"} readOnly className="accent-black" />
            </label>

            <label
              onClick={() => setTargetScope("all")}
              className={`p-4 border cursor-pointer flex items-center justify-between transition-none ${
                targetScope === "all" ? "bg-white border-black shadow-sm" : "bg-neutral-100 border-neutral-300 text-neutral-500"
              }`}
            >
              <div>
                <div className="font-bold text-xs uppercase text-neutral-900">All Discovered Cluster Nodes</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Batch test all {nodes.length} nodes across the lab network
                </div>
              </div>
              <input type="radio" checked={targetScope === "all"} readOnly className="accent-black" />
            </label>
          </div>

          <button
            onClick={handleRunEvaluation}
            disabled={evaluating || !benchmark || (!node && nodes.length === 0)}
            className="w-full flex justify-center items-center gap-2 bg-black text-white p-3 font-bold uppercase text-[11px] hover:bg-neutral-800 disabled:opacity-50 transition-none shadow-sm"
          >
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {evaluating
              ? progress
                ? `Evaluating ${progress.nodeName} (${progress.current}/${progress.total})...`
                : "Running Evaluation..."
              : `Execute Benchmark Check (${targetScope === "selected" ? "1 Node" : `${nodes.length} Nodes`})`}
          </button>
        </div>

        {/* Step 3: Results Dashboard */}
        {results && (
          <div className="border border-neutral-300 bg-white shadow-sm space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-lg font-bold uppercase text-neutral-900">Evaluation Results</h2>
                <div className="text-[10px] text-neutral-500">
                  Evaluated {results.length} nodes against benchmark: {benchmark?.name}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="text-green-700">
                  PASSED: {results.filter((r) => r.status === "PASSED").length}
                </div>
                <div className="text-amber-700">
                  PARTIAL: {results.filter((r) => r.status === "PARTIAL").length}
                </div>
                <div className="text-red-700">
                  FAILED: {results.filter((r) => r.status === "FAILED" || r.status === "ERROR").length}
                </div>
              </div>
            </div>

            {/* Student Result Cards */}
            <div className="space-y-3">
              {results.map((r) => {
                const isExpanded = expandedNodeId === r.nodeId;
                const badgeColor =
                  r.status === "PASSED"
                    ? "bg-green-100 text-green-800 border-green-300"
                    : r.status === "PARTIAL"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-red-100 text-red-800 border-red-300";

                return (
                  <div key={r.nodeId} className="border border-neutral-200 bg-neutral-50 overflow-hidden">
                    <div
                      onClick={() => setExpandedNodeId(isExpanded ? null : r.nodeId)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-600" /> : <ChevronRight className="w-4 h-4 text-neutral-600" />}
                        <div>
                          <span className="font-bold text-neutral-900 uppercase text-xs">{r.hostname}</span>
                          <span className="text-[10px] text-neutral-500 ml-2">
                            ({r.dbIp}:{r.dbPort})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${badgeColor}`}>
                          {r.status}
                        </span>
                        <span className="text-sm font-bold text-neutral-900 w-24 text-right">
                          {r.scorePercentage}% ({r.earnedPoints}/{r.totalPoints})
                        </span>
                      </div>
                    </div>

                    {/* Detailed itemized breakdown */}
                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-neutral-200 space-y-2">
                        {r.errorMessage && (
                          <div className="p-3 bg-red-50 text-red-800 border border-red-200 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {r.errorMessage}
                          </div>
                        )}

                        <div className="text-[10px] font-bold uppercase text-neutral-500 mb-2">Itemized Rubric Breakdown:</div>

                        <div className="space-y-1.5 max-h-80 overflow-auto">
                          {r.checks.map((c, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between p-2.5 border text-xs ${
                                c.passed ? "bg-green-50/50 border-green-200 text-neutral-800" : "bg-red-50/50 border-red-200 text-neutral-800"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {c.passed ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                                <div>
                                  <div className="font-bold text-[11px]">{c.title}</div>
                                  <div className="text-[9px] text-neutral-500">{c.message}</div>
                                </div>
                              </div>
                              <span className={`text-[11px] font-bold ${c.passed ? "text-green-700" : "text-red-700"}`}>
                                +{c.earned} / {c.points} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}