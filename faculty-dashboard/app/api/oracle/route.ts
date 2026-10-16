

import { NextRequest, NextResponse } from "next/server";

import oracledb from "oracledb";

import {

  groupConstraintRows,

  isOracleConstraintAction,

  isSafeOracleIdentifier,

  type ConstraintSchemaRow,

} from "@/lib/schema-metadata";



export const dynamic = "force-dynamic";

export const runtime = "nodejs";



oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;



interface OracleConfig {

  host: string;

  port?: number;

  serviceName?: string;

  user: string;

  password: string;

  asSysdba?: boolean;

}



type Row = Record<string, any>;



function getConnectString(config: OracleConfig): string {

  const host = config.host || "127.0.0.1";

  const port = config.port || 1521;

  const service = config.serviceName || "FREEPDB1";

  return `${host}:${port}/${service}`;

}



function getTargetUser(config: OracleConfig): string {

  return config.user.toUpperCase() === "SYS" || config.asSysdba

    ? "STUDENT"

    : config.user.toUpperCase();

}



async function getConnection(config: OracleConfig) {

  const connectionConfig: oracledb.ConnectionAttributes = {

    user: config.user,

    password: config.password,

    connectString: getConnectString(config),

    privilege: config.asSysdba ? oracledb.SYSDBA : undefined,

  };



  return oracledb.getConnection(connectionConfig);

}



function rowsOf(result: oracledb.Result<unknown>): Row[] {

  return (result.rows ?? []) as Row[];

}



function groupRows<T>(

  rows: Row[],

  keyOf: (row: Row) => string,

  mapRow: (row: Row) => T,

): Map<string, T[]> {

  const grouped = new Map<string, T[]>();



  for (const row of rows) {

    const key = keyOf(row);

    const items = grouped.get(key) ?? [];

    items.push(mapRow(row));

    grouped.set(key, items);

  }



  return grouped;

}



export async function POST(req: NextRequest) {

  let connection: oracledb.Connection | null = null;



  try {

    const body = await req.json();



    const {

      action,

      config,

      sql,

      sid,

      serial,

      newPassword,

      tableName,

      constraintName,

      constraintAction,

    } = body;



    if (!config?.host) {

      return NextResponse.json(

        { success: false, error: "Host address required" },

        { status: 400 },

      );

    }



    connection = await getConnection(config);



    // 1. Test the Oracle connection.

    if (action === "ping") {

      const result = await connection.execute(

        "SELECT sysdate, banner FROM v$version WHERE ROWNUM = 1",

      );



      return NextResponse.json({

        success: true,

        data: result.rows ?? [],

        connectString: getConnectString(config),

      });

    }



    // 2. Execute a SQL statement.

    if (action === "query") {

      if (typeof sql !== "string" || !sql.trim()) {

        return NextResponse.json(

          { success: false, error: "SQL statement is required" },

          { status: 400 },

        );

      }



      const startTime = Date.now();



      const result = await connection.execute(sql, [], {

        autoCommit: true,

        maxRows: 500,

      });



      return NextResponse.json({

        success: true,

        columns: result.metaData?.map((column) => column.name) ?? [],

        rows: result.rows ?? [],

        rowsAffected: result.rowsAffected ?? result.rows?.length ?? 0,

        durationMs: Date.now() - startTime,

      });

    }



    // 3. List tables in the target schema.

    if (action === "get-tables") {

      const targetUser = getTargetUser(config);



      const result = await connection.execute(

        `SELECT table_name, tablespace_name

         FROM all_tables

         WHERE owner = :owner

         ORDER BY table_name`,

        { owner: targetUser },

      );



      return NextResponse.json({

        success: true,

        targetUser,

        tables: rowsOf(result),

      });

    }



    // 4. Retrieve columns, constraints and indexes for one table.

    if (action === "get-table-schema") {

      if (typeof tableName !== "string" || !tableName.trim()) {

        return NextResponse.json(

          { success: false, error: "Table name is required" },

          { status: 400 },

        );

      }



      const targetUser = getTargetUser(config);

      const targetTable = tableName.toUpperCase();



      if (!isSafeOracleIdentifier(targetTable)) {

        return NextResponse.json(

          { success: false, error: "Invalid table name" },

          { status: 400 },

        );

      }



      const [columnsResult, constraintsResult, indexesResult] =

        await Promise.all([

          connection.execute(

            `SELECT column_name,

                    data_type,

                    data_length,

                    char_length,

                    char_used,

                    data_precision,

                    data_scale,

                    nullable,

                    data_default,

                    virtual_column,

                    identity_column

             FROM all_tab_cols

             WHERE owner = :owner

               AND table_name = :tableName

             ORDER BY column_id`,

            { owner: targetUser, tableName: targetTable },

          ),



          connection.execute(

            `SELECT c.constraint_name,

                    c.constraint_type,

                    c.search_condition_vc AS search_condition,

                    c.r_constraint_name,

                    r.table_name AS r_table_name,

                    cc.column_name,

                    cc.position AS column_position,

                    rcc.column_name AS referenced_column_name,

                    c.delete_rule,

                    c.status,

                    c.deferrable,

                    c.deferred,

                    c.validated

             FROM all_constraints c

             LEFT JOIN all_cons_columns cc

               ON cc.owner = c.owner

              AND cc.constraint_name = c.constraint_name

              AND cc.table_name = c.table_name

             LEFT JOIN all_constraints r

               ON r.owner = c.r_owner

              AND r.constraint_name = c.r_constraint_name

             LEFT JOIN all_cons_columns rcc

               ON rcc.owner = r.owner

              AND rcc.constraint_name = r.constraint_name

              AND rcc.table_name = r.table_name

              AND rcc.position = cc.position

             WHERE c.owner = :owner

               AND c.table_name = :tableName

             ORDER BY c.constraint_type,

                      c.constraint_name,

                      cc.position`,

            { owner: targetUser, tableName: targetTable },

          ),



          connection.execute(

            `SELECT i.index_name,

                    i.uniqueness,

                    ic.column_name,

                    ic.column_position

             FROM all_indexes i

             JOIN all_ind_columns ic

               ON ic.index_owner = i.owner

              AND ic.index_name = i.index_name

             WHERE i.owner = :owner

               AND i.table_name = :tableName

             ORDER BY i.index_name, ic.column_position`,

            { owner: targetUser, tableName: targetTable },

          ),

        ]);



      const constraints = groupConstraintRows(

        rowsOf(constraintsResult) as ConstraintSchemaRow[],

      );



      return NextResponse.json({

        success: true,

        targetUser,

        schema: {

          tableName: targetTable,

          columns: rowsOf(columnsResult),

          constraints,

          indexes: rowsOf(indexesResult),

        },

      });

    }



    // 5. Retrieve advanced schema objects for benchmark evaluation.

    if (action === "get-advanced-objects") {

      const targetUser = getTargetUser(config);



      const [

        indexesResult,

        indexColumnsResult,

        indexExpressionsResult,

        viewsResult,

        materializedViewsResult,

        sequencesResult,

        synonymsResult,

        databaseLinksResult,

      ] = await Promise.all([

        connection.execute(

          `SELECT index_name AS "name",

                  table_name AS "tableName",

                  index_type AS "indexType",

                  uniqueness AS "uniqueness",

                  status AS "status",

                  visibility AS "visibility"

           FROM all_indexes

           WHERE owner = :owner

           ORDER BY index_name`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT index_name AS "indexName",

                  table_name AS "tableName",

                  column_name AS "columnName",

                  column_position AS "columnPosition"

           FROM all_ind_columns

           WHERE index_owner = :owner

           ORDER BY index_name, column_position`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT index_name AS "indexName",

                  table_name AS "tableName",

                  column_position AS "columnPosition",

                  column_expression AS "expression"

           FROM all_ind_expressions

           WHERE index_owner = :owner

           ORDER BY index_name, column_position`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT view_name AS "name",

                  text_vc AS "text",

                  read_only AS "readOnly"

           FROM all_views

           WHERE owner = :owner

           ORDER BY view_name`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT mview_name AS "name",

                  refresh_mode AS "refreshMode",

                  refresh_method AS "refreshMethod",

                  build_mode AS "buildMode",

                  rewrite_enabled AS "rewriteEnabled",

                  staleness AS "staleness",

                  compile_state AS "compileState"

           FROM all_mviews

           WHERE owner = :owner

           ORDER BY mview_name`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT sequence_name AS "name",

                  min_value AS "minValue",

                  max_value AS "maxValue",

                  increment_by AS "incrementBy",

                  cycle_flag AS "cycleFlag",

                  order_flag AS "orderFlag",

                  cache_size AS "cacheSize"

           FROM all_sequences

           WHERE sequence_owner = :owner

           ORDER BY sequence_name`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT synonym_name AS "name",

                  owner AS "owner",

                  table_owner AS "tableOwner",

                  table_name AS "tableName",

                  db_link AS "dbLink"

           FROM all_synonyms

           WHERE owner = :owner

              OR (owner = 'PUBLIC' AND table_owner = :owner)

           ORDER BY synonym_name`,

          { owner: targetUser },

        ),



        connection.execute(

          `SELECT db_link AS "name",

                  owner AS "owner",

                  username AS "username",

                  host AS "host"

           FROM all_db_links

           WHERE owner = :owner

           ORDER BY db_link`,

          { owner: targetUser },

        ),

      ]);



      const indexColumns = groupRows(

        rowsOf(indexColumnsResult),

        (row) => `${row.tableName}.${row.indexName}`,

        (row) => ({

          name: row.columnName,

          position: Number(row.columnPosition),

        }),

      );



      const indexExpressions = groupRows(

        rowsOf(indexExpressionsResult),

        (row) => `${row.tableName}.${row.indexName}`,

        (row) => ({

          position: Number(row.columnPosition),

          expression: row.expression,

        }),

      );


      const indexes = rowsOf(indexesResult).map((index) => {

        const key = `${index.tableName}.${index.name}`;

        const columns = indexColumns.get(key) ?? [];

        const expressions = indexExpressions.get(key) ?? [];



        return {

          ...index,

          columns: columns

            .sort((a, b) => a.position - b.position)

            .map((column) => column.name)

            .filter((name) => !/^SYS_NC\d+\$$/i.test(name)),

          expressions: expressions

            .sort((a, b) => a.position - b.position)

            .map((item) => item.expression),

        };

      });



      return NextResponse.json({

        success: true,

        targetUser,

        objects: {

          indexes,

          views: rowsOf(viewsResult),

          materializedViews: rowsOf(materializedViewsResult),

          sequences: rowsOf(sequencesResult),

          synonyms: rowsOf(synonymsResult),

          databaseLinks: rowsOf(databaseLinksResult),

        },

      });

    }



    // 6. List active database sessions.

    if (action === "get-sessions") {

      const result = await connection.execute(

        `SELECT s.sid,

                s.serial#,

                s.username,

                s.status,

                s.osuser,

                s.machine,

                s.program,

                s.last_call_et AS seconds_idle,

                s.sql_id,

                q.sql_text

         FROM v$session s

         LEFT JOIN v$sql q ON q.sql_id = s.sql_id

         WHERE s.type <> 'BACKGROUND'

         ORDER BY s.last_call_et DESC`,

      );



      return NextResponse.json({

        success: true,

        sessions: rowsOf(result),

      });

    }



    // 7. Terminate a database session.

    if (action === "kill-session") {

      if (sid == null || serial == null) {

        return NextResponse.json(

          { success: false, error: "SID and SERIAL# required" },

          { status: 400 },

        );

      }



      const sessionId = Number(sid);

      const serialNumber = Number(serial);



      if (

        !Number.isSafeInteger(sessionId) ||

        !Number.isSafeInteger(serialNumber) ||

        sessionId <= 0 ||

        serialNumber < 0

      ) {

        return NextResponse.json(

          { success: false, error: "Invalid SID or SERIAL#" },

          { status: 400 },

        );

      }



      await connection.execute(

        `ALTER SYSTEM KILL SESSION '${sessionId},${serialNumber}' IMMEDIATE`,

      );



      return NextResponse.json({

        success: true,

        message: `Session ${sessionId},${serialNumber} terminated`,

      });

    }



    // 8. Unlock/reset the STUDENT account.

    if (action === "reset-student") {

      const password = newPassword || "StudentPassword123";



      if (

        typeof password !== "string" ||

        password.length < 8 ||

        password.length > 128 ||

        !/^[A-Za-z0-9_$#]+$/.test(password)

      ) {

        return NextResponse.json(

          {

            success: false,

            error:

              "Password must be 8-128 characters using letters, numbers, _, $, or #",

          },

          { status: 400 },

        );

      }



      await connection.execute(

        `ALTER USER STUDENT IDENTIFIED BY "${password}" ACCOUNT UNLOCK`,

      );



      return NextResponse.json({

        success: true,

        message: "STUDENT account unlocked and password updated",

      });

    }



    // 9. Enable or disable a table constraint.

    if (action === "update-constraint") {

      const username = config.user?.toUpperCase();



      if (

        !config.asSysdba &&

        username !== "SYS" &&

        username !== "SYSTEM"

      ) {

        return NextResponse.json(

          {

            success: false,

            error: "Administrator credentials are required to change constraints",

          },

          { status: 403 },

        );

      }



      const targetUser = getTargetUser(config);

      const targetTable = String(tableName || "").toUpperCase();

      const targetConstraint = String(constraintName || "").toUpperCase();



      if (

        !isSafeOracleIdentifier(targetTable) ||

        !isSafeOracleIdentifier(targetConstraint)

      ) {

        return NextResponse.json(

          { success: false, error: "Invalid table or constraint name" },

          { status: 400 },

        );

      }



      if (!isOracleConstraintAction(constraintAction)) {

        return NextResponse.json(

          { success: false, error: "Unsupported constraint action" },

          { status: 400 },

        );

      }



      const exists = await connection.execute(

        `SELECT 1

         FROM all_constraints

         WHERE owner = :owner

           AND table_name = :tableName

           AND constraint_name = :constraintName`,

        {

          owner: targetUser,

          tableName: targetTable,

          constraintName: targetConstraint,

        },

      );



      if (!exists.rows?.length) {

        return NextResponse.json(

          {

            success: false,

            error: "Constraint not found on the selected table",

          },

          { status: 404 },

        );

      }



      await connection.execute(

        `ALTER TABLE "${targetUser}"."${targetTable}" ${constraintAction} CONSTRAINT "${targetConstraint}"`,

      );



      return NextResponse.json({

        success: true,

        message: `${targetConstraint}: ${constraintAction}`,

      });

    }



    return NextResponse.json(

      { success: false, error: `Unknown action: ${action}` },

      { status: 400 },

    );

  } catch (error: unknown) {

    const err = error as {

      message?: string;

      errorNum?: number;

      code?: string;

    };



    return NextResponse.json(

      {

        success: false,

        error: err.message || "Oracle request failed",

        code: err.errorNum ?? err.code,

      },

      { status: 500 },

    );

  } finally {

    if (connection) {

      try {

        await connection.close();

      } catch (closeError) {

        console.error("Error closing Oracle connection", closeError);

      }

    }

  }

}
