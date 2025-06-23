import { DODialect } from "kysely-do";
import { DurableObject } from "cloudflare:workers";

import { Kysely, CompiledQuery, QueryResult } from "kysely";
import { createMigrator } from "./index.js";
import debug from "../debug.js";

const log = debug("sdk:do-db");

// Base class for Durable Objects that need Kysely database access
export class SqliteDurableObject<T = any> extends DurableObject {
  public migrations: Record<string, any>;
  public kysely: Kysely<T>;
  private initialized = false;
  private migrationTableName: string;

  constructor(
    ctx: DurableObjectState,
    env: any,
    migrations: Record<string, any>,
    migrationTableName = "__migrations",
  ) {
    super(ctx, env);
    this.migrations = migrations;
    this.migrationTableName = migrationTableName;

    this.kysely = new Kysely<T>({
      dialect: new DODialect({ ctx }),
    });
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      log("Database already initialized, skipping");
      return;
    }

    log("Initializing Durable Object database");
    const migrator = createMigrator(
      this.kysely,
      this.migrations,
      this.migrationTableName,
    );
    await migrator.migrateToLatest();
    this.initialized = true;
    log("Database initialization complete");
  }

  // RPC method for executing queries - must be on prototype for RPC to work
  async kyselyExecuteQuery<R>(compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }): Promise<QueryResult<R>> {
    await this.initialize();

    log(
      "Executing SQL: %s with params: %o",
      compiledQuery.sql,
      compiledQuery.parameters,
    );

    // Forward to the internal Kysely database
    const result = await this.kysely.executeQuery({
      sql: compiledQuery.sql,
      parameters: compiledQuery.parameters,
      query: {} as any,
      queryId: {} as any,
    } as CompiledQuery<unknown>);
    return result as QueryResult<R>;
  }
}
