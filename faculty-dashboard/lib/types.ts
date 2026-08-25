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
  NUM_ROWS: number | null;
  TABLESPACE_NAME?: string;
  STATUS: string;
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

export type ActiveView = "overview" | "health" | "sql" | "schema" | "sessions" | "evaluation" | "rescue" | "audit";

export interface StatusMessage {
  text: string;
  ok: boolean;
  type?: "success" | "error" | "info" | "loading";
  code?: number | string;
}
