import {
  Kysely,
  Driver,
  DatabaseConnection,
  CompiledQuery,
  QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";
import { DODialect } from "kysely-do";
import { DurableObject } from "cloudflare:workers";
import { createMigrator } from "./migrations.js";
import debug from "../debug.js";

const log = debug("sdk:do-db");

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

  private async initialize(): Promise<void> {
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

// DOWorkerDialect - mimics DODialect but proxies to DO
export class DOWorkerDialect {
  #config: { stub: any };

  constructor(config: { stub: any }) {
    this.#config = config;
  }

  createAdapter() {
    return new SqliteAdapter();
  }

  createDriver() {
    return new DOWorkerDriver(this.#config);
  }

  createQueryCompiler() {
    return new SqliteQueryCompiler();
  }

  createIntrospector(db: any) {
    return new SqliteIntrospector(db);
  }
}

class DOWorkerDriver implements Driver {
  #config: { stub: any };

  constructor(config: { stub: any }) {
    this.#config = config;
  }

  async init() {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new DOWorkerConnection(this.#config.stub.kyselyExecuteQuery);
  }

  async beginTransaction(conn: any) {
    return await conn.beginTransaction();
  }

  async commitTransaction(conn: any) {
    return await conn.commitTransaction();
  }

  async rollbackTransaction(conn: any) {
    return await conn.rollbackTransaction();
  }

  async releaseConnection(_conn: any) {}

  async destroy() {}
}

class DOWorkerConnection implements DatabaseConnection {
  #executeQuery: (compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }) => Promise<QueryResult<any>>;

  constructor(
    executeQuery: (compiledQuery: {
      sql: string;
      parameters: readonly unknown[];
    }) => Promise<QueryResult<any>>,
  ) {
    this.#executeQuery = executeQuery;
  }

  async executeQuery<R>(compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }): Promise<QueryResult<R>> {
    log("Forwarding query to Durable Object: %s", compiledQuery.sql);

    // Call the DO's kyselyExecuteQuery method
    const result = await this.#executeQuery({
      sql: compiledQuery.sql,
      parameters: compiledQuery.parameters,
    });

    return result as QueryResult<R>;
  }

  async beginTransaction() {
    throw new Error("Transactions are not supported yet.");
  }

  async commitTransaction() {
    throw new Error("Transactions are not supported yet.");
  }

  async rollbackTransaction() {
    throw new Error("Transactions are not supported yet.");
  }

  async *streamQuery(_compiledQuery: any, _chunkSize?: any) {
    throw new Error("DO Driver does not support streaming");
  }
}
