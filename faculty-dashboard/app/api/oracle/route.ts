import { NextRequest, NextResponse } from "next/server";
import oracledb from "oracledb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Use Object format for query results
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

interface OracleConfig {
  host: string;
  port?: number;
  serviceName?: string;
  user: string;
  password: string;
  asSysdba?: boolean;
}

function getConnectString(config: OracleConfig): string {
  const host = config.host || "127.0.0.1";
  const port = config.port || 1521;
  const service = config.serviceName || "FREEPDB1";
  return `${host}:${port}/${service}`;
}

async function getConnection(config: OracleConfig) {
  const connConfig: oracledb.ConnectionAttributes = {
    user: config.user,
    password: config.password,
    connectString: getConnectString(config),
    privilege: config.asSysdba ? oracledb.SYSDBA : undefined,
  };
  return await oracledb.getConnection(connConfig);
}

export async function POST(req: NextRequest) {
  let connection: oracledb.Connection | null = null;
  try {
    const body = await req.json();
    const { action, config, sql, sid, serial, newPassword } = body;

    if (!config || !config.host) {
      return NextResponse.json({ success: false, error: "Host address required" }, { status: 400 });
    }

    connection = await getConnection(config);

    if (action === "ping") {
      const result = await connection.execute("SELECT sysdate, banner FROM v$version WHERE ROWNUM = 1");
      return NextResponse.json({
        success: true,
        data: result.rows,
        connectString: getConnectString(config),
      });
    }

    if (action === "query") {
      if (!sql) {
        return NextResponse.json({ success: false, error: "SQL statement is required" }, { status: 400 });
      }
      
      const startTime = Date.now();
      const result = await connection.execute(sql, [], {
        autoCommit: true,
        maxRows: 500,
      });
      const durationMs = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        columns: result.metaData ? result.metaData.map((m: any) => m.name) : [],
        rows: result.rows || [],
        rowsAffected: result.rowsAffected ?? (result.rows ? result.rows.length : 0),
        durationMs,
      });
    }

    if (action === "get-tables") {
      const targetUser = (config.user === "SYS" || config.asSysdba) ? "STUDENT" : config.user.toUpperCase();
      const result = await connection.execute(
        `SELECT table_name, num_rows, tablespace_name, status 
         FROM all_tables 
         WHERE owner = :owner 
         ORDER BY table_name`,
        [targetUser]
      );
      return NextResponse.json({
        success: true,
        tables: result.rows || [],
        targetUser,
      });
    }

    if (action === "get-sessions") {
      const result = await connection.execute(
        `SELECT s.sid, s.serial#, s.username, s.status, s.osuser, s.machine, s.program,
                s.last_call_et as seconds_idle, s.sql_id, q.sql_text
         FROM v$session s
         LEFT JOIN v$sql q ON s.sql_id = q.sql_id
         WHERE s.type != 'BACKGROUND'
         ORDER BY s.last_call_et DESC`
      );
      return NextResponse.json({
        success: true,
        sessions: result.rows || [],
      });
    }

    if (action === "kill-session") {
      if (!sid || !serial) {
        return NextResponse.json({ success: false, error: "SID and SERIAL# required" }, { status: 400 });
      }
      await connection.execute(`ALTER SYSTEM KILL SESSION '${sid},${serial}' IMMEDIATE`);
      return NextResponse.json({
        success: true,
        message: `Session ${sid},${serial} terminated immediately`,
      });
    }

    if (action === "reset-student") {
      const pwd = newPassword || "StudentPassword123";
      await connection.execute(`ALTER USER STUDENT IDENTIFIED BY "${pwd}" ACCOUNT UNLOCK`);
      return NextResponse.json({
        success: true,
        message: `Student account unlocked with password: ${pwd}`,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || String(err),
        code: err.errorNum || err.code,
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Error closing connection", closeErr);
      }
    }
  }
}
