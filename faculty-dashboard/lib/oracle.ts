import type { OracleConfig, QueryResult, SchemaTable, OracleSession, TableSchemaDetail } from "./types";

const ORACLE_ENDPOINT = "/api/oracle";

async function post(body: Record<string, unknown>): Promise<Response> {
  return fetch(ORACLE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function pingOracle(
  config: OracleConfig
): Promise<{ ok: boolean; connectString?: string; data?: any[]; error?: string }> {
  const res = await post({ action: "ping", config });
  const data = await res.json();
  if (data.success) {
    return { ok: true, connectString: data.connectString, data: data.data };
  }
  return { ok: false, error: data.error };
}

export async function runQuery(
  config: OracleConfig,
  sql: string
): Promise<{ ok: boolean; result?: QueryResult; error?: string; code?: number | string }> {
  const res = await post({ action: "query", config, sql });
  const data = await res.json();
  if (data.success) {
    return {
      ok: true,
      result: {
        columns: data.columns,
        rows: data.rows,
        durationMs: data.durationMs,
        rowsAffected: data.rowsAffected,
      },
    };
  }
  return { ok: false, error: data.error, code: data.code };
}

export async function getTables(
  config: OracleConfig
): Promise<{ ok: boolean; tables?: SchemaTable[]; targetUser?: string; error?: string }> {
  const res = await post({ action: "get-tables", config });
  const data = await res.json();
  if (data.success) {
    return { ok: true, tables: data.tables as SchemaTable[], targetUser: data.targetUser };
  }
  return { ok: false, error: data.error };
}

export async function getTableSchema(
  config: OracleConfig,
  tableName: string
): Promise<{ ok: boolean; schema?: TableSchemaDetail; error?: string }> {
  const res = await post({ action: "get-table-schema", config, tableName });
  const data = await res.json();
  if (data.success) {
    return { ok: true, schema: data.schema as TableSchemaDetail };
  }
  return { ok: false, error: data.error };
}

export async function getSessions(
  config: OracleConfig
): Promise<{ ok: boolean; sessions?: OracleSession[]; error?: string }> {
  const res = await post({ action: "get-sessions", config });
  const data = await res.json();
  if (data.success) {
    return { ok: true, sessions: data.sessions as OracleSession[] };
  }
  return { ok: false, error: data.error };
}

export async function killSession(
  config: OracleConfig,
  sid: number,
  serial: number
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await post({ action: "kill-session", config, sid, serial });
  const data = await res.json();
  if (data.success) {
    return { ok: true, message: data.message };
  }
  return { ok: false, error: data.error };
}

export async function resetStudentAccount(
  config: OracleConfig
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await post({ action: "reset-student", config, newPassword: "StudentPassword123" });
  const data = await res.json();
  if (data.success) {
    return { ok: true, message: data.message };
  }
  return { ok: false, error: data.error };
}
