import type { TableColumnDetail, TableConstraintDetail } from "./types";

export type OracleConstraintAction = "ENABLE VALIDATE" | "ENABLE NOVALIDATE" | "DISABLE";

export interface ConstraintSchemaRow {
  CONSTRAINT_NAME: string;
  CONSTRAINT_TYPE: string;
  COLUMN_NAME?: string;
  COLUMN_POSITION?: number;
  REFERENCED_COLUMN_NAME?: string;
  SEARCH_CONDITION?: string;
  R_TABLE_NAME?: string;
  R_CONSTRAINT_NAME?: string;
  DELETE_RULE?: string;
  STATUS?: string;
  DEFERRABLE?: string;
  DEFERRED?: string;
  VALIDATED?: string;
}

export interface SchemaColumnRule {
  name: string;
  type: string;
  nullable: boolean;
  dataLength?: number;
  charLength?: number;
  charUsed?: string;
  precision?: number | null;
  scale?: number | null;
  defaultValue?: string | null;
  identity?: boolean;
  virtual?: boolean;
}

export interface SchemaConstraintRule {
  type: string;
  column?: string;
  columns?: string[];
  rTable?: string;
  referencedColumns?: string[];
  condition?: string;
  status?: string;
  validated?: string;
  deferrable?: string;
  deferred?: string;
  deleteRule?: string;
}

const CONSTRAINT_ACTIONS = new Set<OracleConstraintAction>([
  "ENABLE VALIDATE",
  "ENABLE NOVALIDATE",
  "DISABLE",
]);

export function isSafeOracleIdentifier(value: string): boolean {
  return /^[A-Z][A-Z0-9_$#]{0,127}$/i.test(value);
}

export function isOracleConstraintAction(value: unknown): value is OracleConstraintAction {
  return typeof value === "string" && CONSTRAINT_ACTIONS.has(value as OracleConstraintAction);
}

export function groupConstraintRows(rows: ConstraintSchemaRow[]): TableConstraintDetail[] {
  const grouped = new Map<string, TableConstraintDetail>();
  const sortedRows = [...rows].sort((a, b) => (a.COLUMN_POSITION || 0) - (b.COLUMN_POSITION || 0));

  for (const row of sortedRows) {
    let constraint = grouped.get(row.CONSTRAINT_NAME);
    if (!constraint) {
      constraint = {
        CONSTRAINT_NAME: row.CONSTRAINT_NAME,
        CONSTRAINT_TYPE: row.CONSTRAINT_TYPE,
        COLUMNS: [],
        REFERENCED_COLUMNS: [],
        SEARCH_CONDITION: row.SEARCH_CONDITION,
        R_TABLE_NAME: row.R_TABLE_NAME,
        R_CONSTRAINT_NAME: row.R_CONSTRAINT_NAME,
        DELETE_RULE: row.DELETE_RULE,
        STATUS: row.STATUS,
        DEFERRABLE: row.DEFERRABLE,
        DEFERRED: row.DEFERRED,
        VALIDATED: row.VALIDATED,
      };
      grouped.set(row.CONSTRAINT_NAME, constraint);
    }
    if (row.COLUMN_NAME) {
      constraint.COLUMNS.push(row.COLUMN_NAME);
      constraint.COLUMN_NAME ??= row.COLUMN_NAME;
    }
    if (row.REFERENCED_COLUMN_NAME) constraint.REFERENCED_COLUMNS.push(row.REFERENCED_COLUMN_NAME);
  }

  return Array.from(grouped.values());
}

function normalizeExpression(value?: string | null): string {
  return (value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

export function columnDefinitionMismatches(
  expected: SchemaColumnRule,
  actual: TableColumnDetail
): string[] {
  const mismatches: string[] = [];
  if (actual.DATA_TYPE.toUpperCase() !== expected.type.toUpperCase()) mismatches.push("type");
  if (actual.NULLABLE !== (expected.nullable ? "Y" : "N")) mismatches.push("nullability");
  if (expected.dataLength !== undefined && actual.DATA_LENGTH !== expected.dataLength) mismatches.push("byte length");
  if (expected.charLength !== undefined && actual.CHAR_LENGTH !== expected.charLength) mismatches.push("character length");
  if (expected.charUsed !== undefined && actual.CHAR_USED !== expected.charUsed) mismatches.push("BYTE/CHAR semantics");
  if (expected.precision !== undefined && (actual.DATA_PRECISION ?? null) !== expected.precision) mismatches.push("precision");
  if (expected.scale !== undefined && (actual.DATA_SCALE ?? null) !== expected.scale) mismatches.push("scale");
  if (expected.defaultValue !== undefined && normalizeExpression(actual.DATA_DEFAULT) !== normalizeExpression(expected.defaultValue)) mismatches.push("default");
  if (expected.identity !== undefined && (actual.IDENTITY_COLUMN === "YES") !== expected.identity) mismatches.push("identity");
  if (expected.virtual !== undefined && (actual.VIRTUAL_COLUMN === "YES") !== expected.virtual) mismatches.push("virtual property");
  return mismatches;
}

export function constraintDefinitionMismatches(
  expected: SchemaConstraintRule,
  actual: TableConstraintDetail
): string[] {
  const mismatches: string[] = [];
  const expectedColumns = expected.columns?.length ? expected.columns : expected.column ? [expected.column] : [];
  const actualColumns = actual.COLUMNS || (actual.COLUMN_NAME ? [actual.COLUMN_NAME] : []);

  if (actual.CONSTRAINT_TYPE !== expected.type) mismatches.push("type");
  if (expectedColumns.length && (actualColumns.length !== expectedColumns.length ||
    !actualColumns.every((column, index) => column.toUpperCase() === expectedColumns[index].toUpperCase()))) {
    mismatches.push("columns");
  }
  if (expected.rTable && actual.R_TABLE_NAME?.toUpperCase() !== expected.rTable.toUpperCase()) mismatches.push("referenced table");
  if (expected.referencedColumns?.length && (actual.REFERENCED_COLUMNS.length !== expected.referencedColumns.length ||
    !actual.REFERENCED_COLUMNS.every((column, index) => column.toUpperCase() === expected.referencedColumns?.[index].toUpperCase()))) {
    mismatches.push("referenced columns");
  }
  if (expected.condition && normalizeExpression(actual.SEARCH_CONDITION) !== normalizeExpression(expected.condition)) mismatches.push("condition");
  if (expected.status && actual.STATUS !== expected.status) mismatches.push("status");
  if (expected.validated && actual.VALIDATED !== expected.validated) mismatches.push("validation");
  if (expected.deferrable && actual.DEFERRABLE !== expected.deferrable) mismatches.push("deferrable");
  if (expected.deferred && actual.DEFERRED !== expected.deferred) mismatches.push("deferred mode");
  if (expected.deleteRule && actual.DELETE_RULE !== expected.deleteRule) mismatches.push("delete rule");

  return mismatches;
}
