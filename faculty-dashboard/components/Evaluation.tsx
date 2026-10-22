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
  TableProperties,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";

import type {
  OracleConfig,
  DiscoveredNode,
  BenchmarkConfig,
  BenchmarkTableRule,
  BenchmarkAdvancedObjects,
} from "@/lib/types";

import {
  getTables,
  getTableSchema,
  getAdvancedObjects,
  runQuery,
} from "@/lib/oracle";

import {
  columnDefinitionMismatches,
  constraintDefinitionMismatches,
} from "@/lib/schema-metadata";

interface EvaluationProps {
  config: OracleConfig;
  node: DiscoveredNode | undefined;
  nodes?: DiscoveredNode[];
  onViewRecordDetail?: (evalId: string) => void;
}

interface ItemCheckResult {
  category:
    | "table"
    | "column"
    | "pk"
    | "fk"
    | "constraint"
    | "data"
    | "index"
    | "view"
    | "materializedView"
    | "sequence"
    | "synonym"
    | "databaseLink"
    | "metadata";

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

export function Evaluation({
  config,
  node,
  nodes = [],
  onViewRecordDetail,
}: EvaluationProps) {
  // ------------------------------------------------------------

  // Benchmark state

  // ------------------------------------------------------------

  const [benchmark, setBenchmark] = useState<BenchmarkConfig | null>(null);

  const [capturing, setCapturing] = useState(false);

  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  const [showConfigJson, setShowConfigJson] = useState(false);

  const [copied, setCopied] = useState(false);

  // ------------------------------------------------------------

  // Evaluation state

  // ------------------------------------------------------------

  const [targetScope, setTargetScope] = useState<"selected" | "all">(
    "selected",
  );

  const [evaluating, setEvaluating] = useState(false);

  const [progress, setProgress] = useState<{
    current: number;

    total: number;

    nodeName: string;
  } | null>(null);

  const [results, setResults] = useState<NodeEvaluationResult[] | null>(null);

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // ------------------------------------------------------------

  // Helpers

  // ------------------------------------------------------------

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

  const normalize = (value: unknown) =>
    String(value ?? "")
      .replace(/\s+/g, " ")

      .trim()

      .toUpperCase();

  const makeTargetConfig = (targetNode: DiscoveredNode): OracleConfig => ({
    ...config,

    host: targetNode.dbIp || targetNode.ip,

    port: targetNode.dbPort || config.port,
  });

  // ------------------------------------------------------------

  // Advanced-object evaluation

  //

  // This evaluates indexes, views, materialized views, sequences,

  // synonyms and database-link metadata.

  // ------------------------------------------------------------

  const evaluateAdvancedObjects = async (
    targetConfig: OracleConfig,

    expected: BenchmarkAdvancedObjects,
  ): Promise<ItemCheckResult[]> => {
    const response = await getAdvancedObjects(targetConfig);

    if (!response.ok || !response.objects) {
      throw new Error(
        response.error || "Could not retrieve advanced-object metadata",
      );
    }

    const actual = response.objects;

    console.log(
      "[INDEX DEBUG] Expected indexes:",

      expected.indexes?.map((i) => ({
        name: i.name,

        tableName: i.tableName,
      })),
    );

    console.log(
      "[INDEX DEBUG] Actual indexes:",

      actual.indexes?.map((i) => ({
        name: i.name,

        tableName: i.tableName,
      })),
    );

    const checks: ItemCheckResult[] = [];

    const addCheck = (
      category: ItemCheckResult["category"],

      title: string,

      passed: boolean,

      message: string,
    ) => {
      checks.push({
        category,

        title,

        passed,

        message,

        points: 5,

        earned: passed ? 5 : 0,
      });
    };

    // Indexes

    for (const exp of expected.indexes ?? []) {
      const got = actual.indexes.find(
        (item) =>
          normalize(item.name) === normalize(exp.name) &&
          normalize(item.tableName) === normalize(exp.tableName),
      );

      console.log("[INDEX DEBUG] Comparing:", exp.name, {
        expectedTable: exp.tableName,
        found: !!got,
        actualName: got?.name,
        actualTable: got?.tableName,
      });

      const columnsMatch =
        !!got &&
        JSON.stringify(got.columns.map(normalize)) ===
          JSON.stringify(exp.columns.map(normalize));

      const expressionsMatch =
        !!got &&
        JSON.stringify((got.expressions ?? []).map(normalize)) ===
          JSON.stringify((exp.expressions ?? []).map(normalize));

      const statusMatch =
        !got ||
        exp.status === undefined ||
        normalize(got.status) === normalize(exp.status);

      const visibilityMatch =
        !got ||
        exp.visibility === undefined ||
        normalize(got.visibility) === normalize(exp.visibility);

      const passed =
        !!got &&
        normalize(got.tableName) === normalize(exp.tableName) &&
        normalize(got.indexType) === normalize(exp.indexType) &&
        normalize(got.uniqueness) === normalize(exp.uniqueness) &&
        columnsMatch &&
        expressionsMatch &&
        statusMatch &&
        visibilityMatch;

      addCheck(
        "index",

        `Index ${exp.name}`,

        passed,

        !got
          ? "Index missing"
          : passed
            ? "Index definition matches"
            : "Index properties, status, visibility, or indexed columns differ",
      );
    }

    // Views

    for (const exp of expected.views ?? []) {
      const got = actual.views.find(
        (item) => normalize(item.name) === normalize(exp.name),
      );

      const textMatches =
        !exp.text || normalize(got?.text) === normalize(exp.text);

      const readOnlyMatches =
        exp.readOnly === undefined || got?.readOnly === exp.readOnly;

      const passed = !!got && textMatches && readOnlyMatches;

      addCheck(
        "view",

        `View ${exp.name}`,

        passed,

        !got
          ? "View missing"
          : passed
            ? "View definition matches"
            : "View query or read-only setting differs",
      );
    }

    // Materialized views

    for (const exp of expected.materializedViews ?? []) {
      const got = actual.materializedViews.find(
        (item) => normalize(item.name) === normalize(exp.name),
      );

      const passed =
        !!got &&
        normalize(got.refreshMode) === normalize(exp.refreshMode) &&
        normalize(got.refreshMethod) === normalize(exp.refreshMethod) &&
        normalize(got.buildMode) === normalize(exp.buildMode) &&
        normalize(got.rewriteEnabled) === normalize(exp.rewriteEnabled);

      addCheck(
        "materializedView",

        `Materialized View ${exp.name}`,

        passed,

        !got
          ? "Materialized view missing"
          : passed
            ? "Configuration matches"
            : "Refresh, build, or query-rewrite settings differ",
      );
    }

    // Sequences

    for (const exp of expected.sequences ?? []) {
      const got = actual.sequences.find(
        (item) => normalize(item.name) === normalize(exp.name),
      );

      const passed =
        !!got &&
        normalize(got.minValue) === normalize(exp.minValue) &&
        normalize(got.maxValue) === normalize(exp.maxValue) &&
        got.incrementBy === exp.incrementBy &&
        normalize(got.cycleFlag) === normalize(exp.cycleFlag) &&
        normalize(got.orderFlag) === normalize(exp.orderFlag) &&
        got.cacheSize === exp.cacheSize;

      addCheck(
        "sequence",

        `Sequence ${exp.name}`,

        passed,

        !got
          ? "Sequence missing"
          : passed
            ? "Sequence configuration matches"
            : "Sequence properties differ",
      );
    }

    // Synonyms

    for (const exp of expected.synonyms ?? []) {
      const got = actual.synonyms.find(
        (item) =>
          normalize(item.name) === normalize(exp.name) &&
          normalize(item.owner) === normalize(exp.owner),
      );

      const passed =
        !!got &&
        normalize(got.tableOwner) === normalize(exp.tableOwner) &&
        normalize(got.tableName) === normalize(exp.tableName) &&
        normalize(got.dbLink) === normalize(exp.dbLink);

      addCheck(
        "synonym",

        `Synonym ${exp.owner}.${exp.name}`,

        passed,

        !got
          ? "Synonym missing"
          : passed
            ? "Synonym target matches"
            : "Synonym target differs",
      );
    }

    // Database links

    // This checks metadata only, not remote connectivity.

    for (const exp of expected.databaseLinks ?? []) {
      const got = actual.databaseLinks.find(
        (item) =>
          normalize(item.name) === normalize(exp.name) &&
          normalize(item.owner) === normalize(exp.owner),
      );

      const passed =
        !!got &&
        (exp.username === undefined ||
          normalize(got.username) === normalize(exp.username)) &&
        (exp.host === undefined || normalize(got.host) === normalize(exp.host));

      addCheck(
        "databaseLink",

        `Database Link ${exp.owner}.${exp.name}`,

        passed,

        !got
          ? "Database-link metadata missing"
          : passed
            ? "Database-link metadata matches; connectivity not tested"
            : "Database-link metadata differs",
      );
    }

    return checks;
  };

  // ------------------------------------------------------------

  // 1. Capture the reference benchmark

  // ------------------------------------------------------------

  const captureBenchmarkFromDb = async () => {
    if (!node) return;

    setCapturing(true);

    setCaptureStatus(
      `Connecting to ${node.hostname} (${node.dbIp || node.ip})...`,
    );

    try {
      const sourceConfig = makeTargetConfig(node);

      setCaptureStatus("Fetching table catalog...");

      const tablesResp = await getTables(sourceConfig);

      if (
        !tablesResp.ok ||
        !tablesResp.tables ||
        tablesResp.tables.length === 0
      ) {
        setCaptureStatus(
          `Failed: ${tablesResp.error || "No tables found in schema"}`,
        );

        return;
      }

      const tableRules: BenchmarkTableRule[] = [];

      for (let i = 0; i < tablesResp.tables.length; i++) {
        const table = tablesResp.tables[i];

        setCaptureStatus(
          `Analyzing schema for ${table.TABLE_NAME} (${i + 1}/${tablesResp.tables.length})...`,
        );

        const schemaResp = await getTableSchema(
          sourceConfig,

          table.TABLE_NAME,
        );

        if (!schemaResp.ok || !schemaResp.schema) {
          throw new Error(
            `Could not capture schema for ${table.TABLE_NAME}: ${
              schemaResp.error || "Unknown schema error"
            }`,
          );
        }

        const schema = schemaResp.schema;

        // Preserve the team's richer column metadata.

        const columns = schema.columns.map((column) => ({
          name: column.COLUMN_NAME,

          type: column.DATA_TYPE,

          nullable: column.NULLABLE === "Y",

          dataLength: column.DATA_LENGTH,

          charLength: column.CHAR_LENGTH,

          charUsed: column.CHAR_USED,

          precision: column.DATA_PRECISION ?? null,

          scale: column.DATA_SCALE ?? null,

          defaultValue: column.DATA_DEFAULT ?? null,

          identity: column.IDENTITY_COLUMN === "YES",

          virtual: column.VIRTUAL_COLUMN === "YES",
        }));

        // Preserve multi-column constraints and their definitions.

        const constraints: BenchmarkTableRule["constraints"] =
          schema.constraints.map((constraint) => ({
            name: constraint.CONSTRAINT_NAME,

            type: constraint.CONSTRAINT_TYPE,

            column: constraint.COLUMNS?.[0] || constraint.COLUMN_NAME,

            columns:
              constraint.COLUMNS ||
              (constraint.COLUMN_NAME ? [constraint.COLUMN_NAME] : []),

            rTable: constraint.R_TABLE_NAME,

            referencedColumns: constraint.REFERENCED_COLUMNS || [],

            condition: constraint.SEARCH_CONDITION,

            status: constraint.STATUS,

            validated: constraint.VALIDATED,

            deferrable: constraint.DEFERRABLE,

            deferred: constraint.DEFERRED,

            deleteRule: constraint.DELETE_RULE,
          }));

        tableRules.push({
          tableName: table.TABLE_NAME,

          columns,

          constraints,

          requireData: true,
        });
      }

      // Advanced-object capture is attempted separately so a failure

      // does not destroy the successfully captured table benchmark.

      let advancedObjects: BenchmarkAdvancedObjects | undefined;

      let advancedCaptureWarning = "";

      setCaptureStatus(
        "Capturing indexes, views, materialized views, sequences, synonyms, and database links...",
      );

      try {
        const advancedResponse = await getAdvancedObjects(sourceConfig);

        if (!advancedResponse.ok || !advancedResponse.objects) {
          throw new Error(
            advancedResponse.error ||
              "Advanced-object metadata was unavailable",
          );
        }

        advancedObjects = advancedResponse.objects;
      } catch (error: unknown) {
        advancedCaptureWarning =
          error instanceof Error
            ? error.message
            : "Unknown advanced-object capture error";
      }

      const newBenchmark: BenchmarkConfig = {
        name: `Benchmark from ${node.hostname}`,

        sourceNode: node.hostname,

        capturedAt: new Date().toLocaleString(),

        tables: tableRules,

        ...(advancedObjects ? { advancedObjects } : {}),
      };

      setBenchmark(newBenchmark);

      setResults(null);

      if (advancedObjects) {
        setCaptureStatus(
          `Successfully captured ${tableRules.length} tables and advanced-object metadata from ${node.hostname}.`,
        );
      } else {
        setCaptureStatus(
          `Captured ${tableRules.length} tables, but advanced-object capture failed: ${advancedCaptureWarning}. This benchmark does not include advanced objects.`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      setCaptureStatus(`Capture error: ${message}`);
    } finally {
      setCapturing(false);
    }
  };

  // ------------------------------------------------------------

  // 2. Evaluate one target node

  // ------------------------------------------------------------

  const evaluateSingleNode = async (
    targetNode: DiscoveredNode,

    bench: BenchmarkConfig,
  ): Promise<NodeEvaluationResult> => {
    const checks: ItemCheckResult[] = [];

    const targetConfig = makeTargetConfig(targetNode);

    try {
      // Fetch target table catalog.

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

          errorMessage:
            tablesResp.error || "Could not connect to target database",

          checks: [],
        };
      }

      const targetTableNames = new Set(
        tablesResp.tables.map((table) => table.TABLE_NAME.toUpperCase()),
      );

      // Evaluate each expected table.

      for (const expectedTable of bench.tables) {
        const tableName = expectedTable.tableName.toUpperCase();

        const tableExists = targetTableNames.has(tableName);

        // Table existence.

        checks.push({
          category: "table",

          title: `Table '${tableName}' Exists`,

          passed: tableExists,

          message: tableExists
            ? "Table present"
            : `Missing table '${tableName}'`,

          points: 10,

          earned: tableExists ? 10 : 0,
        });

        if (!tableExists) {
          // Missing table means all its expected schema checks fail.

          for (const column of expectedTable.columns) {
            checks.push({
              category: "column",

              title: `${tableName}.${column.name} (${column.type})`,

              passed: false,

              message: "Table missing",

              points: 2,

              earned: 0,
            });
          }

          for (const constraint of expectedTable.constraints) {
            checks.push({
              category:
                constraint.type === "P"
                  ? "pk"
                  : constraint.type === "R"
                    ? "fk"
                    : "constraint",

              title: `${tableName} ${getConstraintLabel(
                constraint.type,
              )} ${constraint.column || ""}`,

              passed: false,

              message: "Table missing",

              points: 5,

              earned: 0,
            });
          }

          if (expectedTable.requireData) {
            checks.push({
              category: "data",

              title: `${tableName} Row Data Populated`,

              passed: false,

              message: "Table missing",

              points: 5,

              earned: 0,
            });
          }

          continue;
        }

        // Fetch the table's target schema.

        const targetSchemaResp = await getTableSchema(
          targetConfig,

          tableName,
        );

        if (!targetSchemaResp.ok || !targetSchemaResp.schema) {
          throw new Error(
            `Could not retrieve target schema for ${tableName}: ${
              targetSchemaResp.error || "Unknown schema error"
            }`,
          );
        }

        const targetColumns = targetSchemaResp.schema.columns;

        const targetConstraints = targetSchemaResp.schema.constraints;

        const targetColumnMap = new Map(
          targetColumns.map((column) => [
            column.COLUMN_NAME.toUpperCase(),

            column,
          ]),
        );

        // --------------------------------------------------------

        // Column checks: preserve the team's definition comparison.

        // --------------------------------------------------------

        for (const expectedColumn of expectedTable.columns) {
          const targetColumn = targetColumnMap.get(
            expectedColumn.name.toUpperCase(),
          );

          const mismatches = targetColumn
            ? columnDefinitionMismatches(
                expectedColumn,

                targetColumn,
              )
            : [];

          const passed = !!targetColumn && mismatches.length === 0;

          checks.push({
            category: "column",

            title: `${tableName}.${expectedColumn.name} (${expectedColumn.type})`,

            passed,

            message: passed
              ? `Column definition matches (${targetColumn?.DATA_TYPE})`
              : !targetColumn
                ? `Missing column '${expectedColumn.name}' in '${tableName}'`
                : `Definition differs: ${mismatches.join(", ")}`,

            points: 2,

            earned: passed ? 2 : 0,
          });
        }

        // --------------------------------------------------------

        // Constraint checks: preserve the team's multi-column and

        // constraint-property comparison.

        // --------------------------------------------------------

        for (const expectedConstraint of expectedTable.constraints) {
          const expectedColumns = expectedConstraint.columns?.length
            ? expectedConstraint.columns
            : expectedConstraint.column
              ? [expectedConstraint.column]
              : [];

          const targetConstraint = targetConstraints.find((candidate) => {
            const actualColumns =
              candidate.COLUMNS ||
              (candidate.COLUMN_NAME ? [candidate.COLUMN_NAME] : []);

            return (
              candidate.CONSTRAINT_TYPE === expectedConstraint.type &&
              (!expectedColumns.length ||
                (actualColumns.length === expectedColumns.length &&
                  actualColumns.every(
                    (column, index) =>
                      column.toUpperCase() ===
                      expectedColumns[index].toUpperCase(),
                  )))
            );
          });

          let passed = false;

          let message: string;

          if (!targetConstraint) {
            message = `Missing ${getConstraintLabel(
              expectedConstraint.type,
            )} on ${expectedColumns.join(", ") || tableName}`;
          } else {
            const mismatches = constraintDefinitionMismatches(
              expectedConstraint,

              targetConstraint,
            );

            passed = mismatches.length === 0;

            message = passed
              ? `Constraint verified: ${
                  expectedColumns.join(", ") || tableName
                }`
              : `Constraint properties differ: ${mismatches.join(", ")}`;
          }

          checks.push({
            category:
              expectedConstraint.type === "P"
                ? "pk"
                : expectedConstraint.type === "R"
                  ? "fk"
                  : "constraint",

            title: `${tableName} ${getConstraintLabel(
              expectedConstraint.type,
            )} (${expectedConstraint.column || expectedConstraint.name})`,

            passed,

            message,

            points: 5,

            earned: passed ? 5 : 0,
          });
        }

        // --------------------------------------------------------

        // Data-population check.

        // --------------------------------------------------------

        if (expectedTable.requireData) {
          const countSchema =
            targetConfig.user?.toUpperCase() === "SYS" || targetConfig.asSysdba
              ? "STUDENT"
              : targetConfig.user || "STUDENT";

          const countQuery = await runQuery(
            targetConfig,

            `SELECT COUNT(*) AS CNT FROM ${countSchema}.${tableName}`,
          );

          if (!countQuery.ok) {
            throw new Error(
              `Could not count rows in ${countSchema}.${tableName}: ${
                countQuery.error || "Query failed"
              }`,
            );
          }

          const rowCount = Number(countQuery.result?.rows?.[0]?.CNT ?? 0);

          const passed = rowCount > 0;

          checks.push({
            category: "data",

            title: `${tableName} Contains Data Rows`,

            passed,

            message: passed
              ? `${rowCount} rows found`
              : "Table is empty (0 rows)",

            points: 5,

            earned: passed ? 5 : 0,
          });
        }
      }

      // ----------------------------------------------------------

      // Advanced schema-object evaluation.

      // ----------------------------------------------------------

      if (bench.advancedObjects) {
        try {
          const advancedChecks = await evaluateAdvancedObjects(
            targetConfig,

            bench.advancedObjects,
          );

          checks.push(...advancedChecks);
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not retrieve advanced-object metadata";

          // Do not award points for an inaccessible metadata query.

          // Zero-point checks keep the error visible without silently

          // changing the denominator and distorting the score.

          checks.push({
            category: "metadata",

            title: "Advanced-object metadata access",

            passed: false,

            message: `Advanced-object evaluation could not complete: ${message}`,

            points: 0,

            earned: 0,
          });
        }
      }

      // ----------------------------------------------------------

      // Calculate score.

      // ----------------------------------------------------------

      const totalPoints = checks.reduce(
        (total, check) => total + check.points,

        0,
      );

      const earnedPoints = checks.reduce(
        (total, check) => total + check.earned,

        0,
      );

      const scorePercentage =
        totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

      const metadataFailed = checks.some(
        (check) => check.category === "metadata" && !check.passed,
      );

      const status: NodeEvaluationResult["status"] = metadataFailed
        ? "ERROR"
        : scorePercentage === 100
          ? "PASSED"
          : scorePercentage >= 50
            ? "PARTIAL"
            : "FAILED";

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

        errorMessage: metadataFailed
          ? "Some advanced-object checks could not be completed. Review the itemized results."
          : undefined,

        checks,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Evaluation encountered an unexpected error";

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

        errorMessage: message,

        checks,
      };
    }
  };

  // ------------------------------------------------------------

  // 3. Run evaluation on selected/all nodes

  // ------------------------------------------------------------

  const handleRunEvaluation = async () => {
    if (!benchmark) return;

    setEvaluating(true);

    setResults(null);

    try {
      const targetNodesList: DiscoveredNode[] =
        targetScope === "selected" && node
          ? [node]
          : nodes.length > 0
            ? nodes
            : node
              ? [node]
              : [];

      if (targetNodesList.length === 0) {
        setCaptureStatus("No target nodes are available for evaluation.");

        return;
      }

      const evaluationResults: NodeEvaluationResult[] = [];

      for (let index = 0; index < targetNodesList.length; index++) {
        const targetNode = targetNodesList[index];

        setProgress({
          current: index + 1,

          total: targetNodesList.length,

          nodeName: targetNode.hostname,
        });

        const result = await evaluateSingleNode(
          targetNode,

          benchmark,
        );

        evaluationResults.push(result);
      }

      setResults(evaluationResults);

      // Auto-persist evaluation records into database storage
      try {
        const studentsResp = await fetch("/api/students");
        const studentsData = await studentsResp.json();
        const studentList = studentsData?.students || [];

        const batchToSave = evaluationResults.map((r) => {
          // Find matching student by node IP or ID
          const matchedStu = studentList.find(
            (s: any) =>
              (s.targetIp && s.targetIp === r.dbIp) ||
              (s.targetNodeId && s.targetNodeId === r.nodeId) ||
              s.targetIp === r.ip
          );

          return {
            studentId: matchedStu?.id || `stu-${r.nodeId}`,
            studentRegNo: matchedStu?.regNo || r.hostname,
            studentName: matchedStu?.name || `Student (${r.hostname})`,
            nodeId: r.nodeId,
            hostname: r.hostname,
            targetIp: r.dbIp || r.ip,
            targetPort: r.dbPort,
            benchmarkName: benchmark.name || "Default Benchmark",
            totalPoints: r.totalPoints,
            earnedPoints: r.earnedPoints,
            scorePercentage: r.scorePercentage,
            status: r.status,
            errorMessage: r.errorMessage,
            checks: r.checks,
            evaluatedAt: new Date().toISOString(),
            evaluatedBy: config.user || "FACULTY",
          };
        });

        await fetch("/api/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchEvaluations: batchToSave }),
        });
      } catch (saveErr) {
        console.error("Failed to persist evaluation records:", saveErr);
      }
    } finally {
      setEvaluating(false);

      setProgress(null);
    }
  };

  // ------------------------------------------------------------

  // Copy benchmark JSON

  // ------------------------------------------------------------

  const handleCopyJson = async () => {
    if (!benchmark) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(benchmark, null, 2));

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCaptureStatus(
        "Could not copy benchmark JSON. Check browser clipboard permissions.",
      );
    }
  };

  // ------------------------------------------------------------

  // UI

  // ------------------------------------------------------------

  return (
    <div className="p-8 bg-white h-full overflow-auto font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}

        <div className="border-b-2 border-black pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-sans font-bold tracking-widest uppercase text-neutral-900 inline-flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-black" />
              Schema Evaluator &amp; Benchmark
            </h1>

            <p className="text-xs text-neutral-500 font-mono mt-1">
              Extract a reference schema and validate student database instances
              automatically.
            </p>
          </div>
        </div>

        {/* Step 1: Capture benchmark */}

        <div className="border border-neutral-300 bg-neutral-50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">
                Step 1
              </span>

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
                  {copied ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}

                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex-1 bg-white border border-neutral-300 p-3 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-bold uppercase text-neutral-500">
                  Reference Source DB
                </div>

                <div className="text-xs font-bold text-neutral-900">
                  {node
                    ? `${node.hostname} (${node.dbIp || node.ip}:${
                        node.dbPort || config.port
                      })`
                    : "NO NODE SELECTED"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[9px] font-bold uppercase text-neutral-500">
                  Status
                </div>

                <div className="text-xs font-bold text-blue-700">
                  {benchmark
                    ? `${benchmark.tables.length} Tables Loaded`
                    : "No Benchmark Set"}
                </div>

                {benchmark && (
                  <div className="text-[9px] text-neutral-500 mt-1">
                    {benchmark.advancedObjects
                      ? "Advanced objects captured"
                      : "Table rules only"}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={captureBenchmarkFromDb}
              disabled={capturing || !node}
              className="px-4 py-3 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold uppercase text-[11px] flex items-center justify-center gap-2 shrink-0"
            >
              {capturing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-yellow-400" />
              )}
              Capture Benchmark from This DB
            </button>
          </div>

          {captureStatus && (
            <div className="mt-3 text-[11px] text-neutral-600 bg-white p-2 border border-neutral-200 flex items-center gap-2">
              <RefreshCw
                className={`w-3 h-3 ${capturing ? "animate-spin" : ""}`}
              />

              <span>{captureStatus}</span>
            </div>
          )}

          {/* Captured table summary */}

          {benchmark && !showConfigJson && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="text-[10px] font-bold uppercase text-neutral-500 mb-2">
                Captured Tables &amp; Rules ({benchmark.tables.length})
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {benchmark.tables.map((table, index) => (
                  <div
                    key={`${table.tableName}-${index}`}
                    className="bg-white p-3 border border-neutral-200 text-xs"
                  >
                    <div className="font-bold text-neutral-900 flex items-center justify-between border-b border-neutral-100 pb-1 mb-2">
                      <span className="flex items-center gap-1.5">
                        <TableProperties className="w-3.5 h-3.5 text-blue-600" />

                        {table.tableName}
                      </span>

                      <span className="text-[9px] text-neutral-400 font-normal">
                        {table.columns.length} cols | {table.constraints.length}{" "}
                        cons
                      </span>
                    </div>

                    <div className="text-[10px] text-neutral-600 space-y-1">
                      <div>
                        <span className="font-bold text-neutral-500">
                          Columns:
                        </span>{" "}
                        {table.columns

                          .map((column) => column.name)

                          .join(", ")}
                      </div>

                      <div>
                        <span className="font-bold text-neutral-500">
                          Constraints:
                        </span>{" "}
                        {table.constraints

                          .map(
                            (constraint) =>
                              `${getConstraintLabel(constraint.type)} (${
                                constraint.columns?.join(", ") ||
                                constraint.column ||
                                constraint.name
                              })`,
                          )

                          .join(", ") || "None"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {benchmark.advancedObjects && (
                <div className="mt-4 p-3 border border-neutral-200 bg-white text-[10px] text-neutral-700">
                  <div className="font-bold uppercase mb-2">
                    Captured Advanced Objects
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div>
                      Indexes: {benchmark.advancedObjects.indexes.length}
                    </div>

                    <div>Views: {benchmark.advancedObjects.views.length}</div>

                    <div>
                      Materialized views:{" "}
                      {benchmark.advancedObjects.materializedViews.length}
                    </div>

                    <div>
                      Sequences: {benchmark.advancedObjects.sequences.length}
                    </div>

                    <div>
                      Synonyms: {benchmark.advancedObjects.synonyms.length}
                    </div>

                    <div>
                      Database links:{" "}
                      {benchmark.advancedObjects.databaseLinks.length}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Benchmark JSON */}

          {benchmark && showConfigJson && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <pre className="bg-neutral-900 text-neutral-100 p-4 text-[10px] overflow-auto max-h-80">
                {JSON.stringify(benchmark, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Step 2: Evaluation */}

        <div className="border border-neutral-300 bg-neutral-50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">
              Step 2
            </span>

            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              Run Evaluation Against Target Databases
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label
              onClick={() => setTargetScope("selected")}
              className={`p-4 border cursor-pointer flex items-center justify-between ${
                targetScope === "selected"
                  ? "bg-white border-black shadow-sm"
                  : "bg-neutral-100 border-neutral-300 text-neutral-500"
              }`}
            >
              <div>
                <div className="font-bold text-xs uppercase text-neutral-900">
                  Current Selected Node Only
                </div>

                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {node ? `${node.hostname} (${node.dbIp || node.ip})` : "None"}
                </div>
              </div>

              <input
                type="radio"
                checked={targetScope === "selected"}
                readOnly
                className="accent-black"
              />
            </label>

            <label
              onClick={() => setTargetScope("all")}
              className={`p-4 border cursor-pointer flex items-center justify-between ${
                targetScope === "all"
                  ? "bg-white border-black shadow-sm"
                  : "bg-neutral-100 border-neutral-300 text-neutral-500"
              }`}
            >
              <div>
                <div className="font-bold text-xs uppercase text-neutral-900">
                  All Discovered Cluster Nodes
                </div>

                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Batch test all {nodes.length} nodes across the lab network
                </div>
              </div>

              <input
                type="radio"
                checked={targetScope === "all"}
                readOnly
                className="accent-black"
              />
            </label>
          </div>

          <button
            onClick={handleRunEvaluation}
            disabled={evaluating || !benchmark || (!node && nodes.length === 0)}
            className="w-full flex justify-center items-center gap-2 bg-black text-white p-3 font-bold uppercase text-[11px] hover:bg-neutral-800 disabled:opacity-50 shadow-sm"
          >
            {evaluating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}

            {evaluating
              ? progress
                ? `Evaluating ${progress.nodeName} (${progress.current}/${progress.total})...`
                : "Running Evaluation..."
              : `Execute Benchmark Check (${
                  targetScope === "selected"
                    ? "1 Node"
                    : `${nodes.length} Nodes`
                })`}
          </button>
        </div>

        {/* Step 3: Results */}

        {results && (
          <div className="border border-neutral-300 bg-white shadow-sm space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-lg font-bold uppercase text-neutral-900">
                  Evaluation Results
                </h2>

                <div className="text-[10px] text-neutral-500">
                  Evaluated {results.length} nodes against benchmark:{" "}
                  {benchmark?.name}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="text-green-700">
                  PASSED:{" "}
                  {
                    results.filter((result) => result.status === "PASSED")
                      .length
                  }
                </div>

                <div className="text-amber-700">
                  PARTIAL:{" "}
                  {
                    results.filter((result) => result.status === "PARTIAL")
                      .length
                  }
                </div>

                <div className="text-red-700">
                  FAILED:{" "}
                  {
                    results.filter(
                      (result) =>
                        result.status === "FAILED" || result.status === "ERROR",
                    ).length
                  }
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {results.map((result) => {
                const isExpanded = expandedNodeId === result.nodeId;

                const badgeColor =
                  result.status === "PASSED"
                    ? "bg-green-100 text-green-800 border-green-300"
                    : result.status === "PARTIAL"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-red-100 text-red-800 border-red-300";

                return (
                  <div
                    key={result.nodeId}
                    className="border border-neutral-200 bg-neutral-50 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNodeId(isExpanded ? null : result.nodeId)
                      }
                      className="w-full text-left p-4 flex items-center justify-between hover:bg-neutral-100"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-neutral-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-neutral-600" />
                        )}

                        <div>
                          <span className="font-bold text-neutral-900 uppercase text-xs">
                            {result.hostname}
                          </span>

                          <span className="text-[10px] text-neutral-500 ml-2">
                            ({result.dbIp}:{result.dbPort})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${badgeColor}`}
                        >
                          {result.status}
                        </span>

                        <span className="text-sm font-bold text-neutral-900 w-24 text-right">
                          {result.scorePercentage}% ({result.earnedPoints}/
                          {result.totalPoints})
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-neutral-200 space-y-2">
                        {result.errorMessage && (
                          <div className="p-3 bg-red-50 text-red-800 border border-red-200 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />

                            {result.errorMessage}
                          </div>
                        )}

                        <div className="text-[10px] font-bold uppercase text-neutral-500 mb-2">
                          Itemized Rubric Breakdown
                        </div>

                        <div className="space-y-1.5 max-h-80 overflow-auto">
                          {result.checks.map((check, index) => (
                            <div
                              key={`${check.category}-${check.title}-${index}`}
                              className={`flex items-center justify-between gap-3 p-2.5 border text-xs ${
                                check.passed
                                  ? "bg-green-50/50 border-green-200 text-neutral-800"
                                  : "bg-red-50/50 border-red-200 text-neutral-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {check.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                                )}

                                <div className="min-w-0">
                                  <div className="font-bold text-[11px]">
                                    {check.title}
                                  </div>

                                  <div className="text-[9px] text-neutral-500 break-words">
                                    {check.message}
                                  </div>

                                  <div className="text-[9px] text-neutral-400 uppercase mt-0.5">
                                    {check.category}
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`text-[11px] font-bold shrink-0 ${
                                  check.passed
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                +{check.earned} / {check.points} pts
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
