export interface OracleConfig {
  host: string;
  port: number;
  serviceName: string;
  user: string;
  password: string;
  asSysdba: boolean;
}

export interface DiscoveredNode {
  id: string;
  hostname: string;
  role: "manager" | "worker";
  ip: string;
  status: "ready" | "down" | "unknown";
  dbContainerName?: string;
  dbIp?: string;
  dbPort?: number;
  dbStatus?: "online" | "offline" | "unknown";
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  durationMs: number;
  rowsAffected: number;
}

export interface SchemaTable {
  TABLE_NAME: string;
  NUM_ROWS?: number | null;
  TABLESPACE_NAME?: string;
  STATUS?: string;
}

export interface TableColumnDetail {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  DATA_LENGTH: number;
  DATA_PRECISION?: number;
  DATA_SCALE?: number;
  NULLABLE: string;
  DATA_DEFAULT?: string;
}

export interface TableConstraintDetail {
  CONSTRAINT_NAME: string;
  CONSTRAINT_TYPE: string;
  COLUMN_NAME?: string;
  SEARCH_CONDITION?: string;
  R_TABLE_NAME?: string;
  R_CONSTRAINT_NAME?: string;
  DELETE_RULE?: string;
  STATUS?: string;
}

export interface TableIndexDetail {
  INDEX_NAME: string;
  UNIQUENESS: string;
  COLUMN_NAME: string;
  COLUMN_POSITION: number;
}

export interface TableSchemaDetail {
  tableName: string;
  columns: TableColumnDetail[];
  constraints: TableConstraintDetail[];
  indexes: TableIndexDetail[];
}

export interface OracleSession {
  SID: number;
  "SERIAL#": number;
  USERNAME?: string;
  STATUS: string;
  OSUSER?: string;
  MACHINE?: string;
  PROGRAM?: string;
  SECONDS_IDLE?: number;
  SQL_ID?: string;
  SQL_TEXT?: string;
}

export type ActiveView = "overview" | "health" | "sql" | "schema" | "sessions" | "evaluation";

export interface StatusMessage {
  text: string;
  ok: boolean;
  type?: "success" | "error" | "info" | "loading";
  code?: number | string;
}
