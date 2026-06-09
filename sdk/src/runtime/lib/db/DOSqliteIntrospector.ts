// NOTE(justinvdm, 9 Jun 2026): This file copies Kysely's SqliteIntrospector.
// Before trying to simplify it, read this comment.
//
// Problem: Cloudflare's DO SQLite adds internal tables (_cf_KV, _cf_METADATA)
// when storage.put/setAlarm is used. Kysely's SqliteIntrospector discovers
// these via sqlite_master, then runs PRAGMA table_info on each. Cloudflare's
// authorizer rejects PRAGMA on _cf_* tables with SQLITE_AUTH, breaking
// migrations and rendering the DO unusable.
//
// Why we copied instead of composed:
// - Kysely's SqliteIntrospector uses JS private fields (#db, #tablesQuery,
//   #getTableMetadata). Private fields are truly private — subclasses cannot
//   override them, and wrappers cannot intercept internal calls.
// - We considered a lighter approach: query sqlite_master with Kysely's
//   builder, then run PRAGMA table_info per-table. This is lighter but
//   requires inlining the table name into raw SQL. Even with escaping,
//   any injection risk is unacceptable. The CTE approach below uses
//   `pragma_table_info(tl.name)` where `tl.name` is a column reference,
//   not an inlined value — zero injection surface.
// - We also considered Kysely plugins (AST rewriting, SQL string rewriting)
//   but these are fragile: they depend on Kysely's internal AST shape and
//   SQL formatting, both of which can change between releases.
//
// This is a copy of Kysely's SqliteIntrospector (MIT licensed) with one
// change: `.where('name', 'not like', '_cf_%')` to exclude Cloudflare tables.
//
// See: https://github.com/redwoodjs/sdk/issues/1219

import {
  type DatabaseMetadata,
  type DatabaseMetadataOptions,
  type Kysely,
  type SchemaMetadata,
  type TableMetadata,
  DEFAULT_MIGRATION_LOCK_TABLE,
  DEFAULT_MIGRATION_TABLE,
  sql,
} from "kysely";

export class DOSqliteIntrospector {
  #db: Kysely<any>;

  constructor(db: Kysely<any>) {
    this.#db = db;
  }

  async getSchemas(): Promise<SchemaMetadata[]> {
    // Sqlite doesn't support schemas.
    return [];
  }

  async getTables(
    options: DatabaseMetadataOptions = { withInternalKyselyTables: false },
  ): Promise<TableMetadata[]> {
    return await this.#getTableMetadata(options);
  }

  async getMetadata(
    options: DatabaseMetadataOptions,
  ): Promise<DatabaseMetadata> {
    return {
      tables: await this.getTables(options),
    };
  }

  #tablesQuery(qb: any, options: DatabaseMetadataOptions) {
    let tablesQuery = qb
      .selectFrom("sqlite_master")
      .where("type", "in", ["table", "view"])
      .where("name", "not like", "sqlite_%")
      // context(justinvdm, 9 Jun 2026): Exclude Cloudflare internal tables.
      // These are added by the DO runtime and cannot be introspected.
      .where("name", "not like", "_cf_%")
      .select(["name", "sql", "type"])
      .orderBy("name");

    if (!options.withInternalKyselyTables) {
      tablesQuery = tablesQuery
        .where("name", "!=", DEFAULT_MIGRATION_TABLE)
        .where("name", "!=", DEFAULT_MIGRATION_LOCK_TABLE);
    }

    return tablesQuery;
  }

  async #getTableMetadata(options: DatabaseMetadataOptions) {
    const tablesResult = await this.#tablesQuery(this.#db, options).execute();
    const tableMetadata = await this.#db
      .with("table_list", (qb) => this.#tablesQuery(qb, options))
      .selectFrom([
        "table_list as tl",
        sql`pragma_table_info(tl.name)`.as("p"),
      ])
      .select([
        "tl.name as table",
        "p.cid",
        "p.name",
        "p.type",
        "p.notnull",
        "p.dflt_value",
        "p.pk",
      ])
      .orderBy("tl.name")
      .orderBy("p.cid")
      .execute();

    const columnsByTable: Record<string, any[]> = {};
    for (const row of tableMetadata) {
      columnsByTable[row.table] ??= [];
      columnsByTable[row.table].push(row);
    }

    return tablesResult.map(({ name, sql: tableSql, type }: any) => {
      let autoIncrementCol = tableSql
        ?.split(/[\(\),]/)
        ?.find((it: string) => it.toLowerCase().includes("autoincrement"))
        ?.trimStart()
        ?.split(/\s+/)?.[0]
        ?.replace(/["`]/g, "");

      const columns = columnsByTable[name] ?? [];

      if (!autoIncrementCol) {
        const pkCols = columns.filter((r) => r.pk > 0);
        if (
          pkCols.length === 1 &&
          pkCols[0].type.toLowerCase() === "integer"
        ) {
          autoIncrementCol = pkCols[0].name;
        }
      }

      return {
        name: name,
        isView: type === "view",
        columns: columns.map((col) => ({
          name: col.name,
          dataType: col.type,
          isNullable: !col.notnull,
          isAutoIncrementing: col.name === autoIncrementCol,
          hasDefaultValue: col.dflt_value != null,
          comment: undefined,
        })),
      };
    });
  }
}
