import debug from "../debug";
import {
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  Driver,
  DatabaseConnection,
  QueryResult,
} from "kysely";

const log = debug("sdk:db:do-worker-dialect");

export class DOWorkerDialect {
  config: { stub: any };

  constructor(config: { stub: any }) {
    this.config = config;
  }

  createAdapter() {
    return new SqliteAdapter();
  }

  createDriver() {
    return new DOWorkerDriver(this.config);
  }

  createQueryCompiler() {
    return new SqliteQueryCompiler();
  }

  createIntrospector(db: any) {
    return new SqliteIntrospector(db);
  }
}

class DOWorkerDriver implements Driver {
  config: { stub: any };

  constructor(config: { stub: any }) {
    this.config = config;
  }

  async init() {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new DOWorkerConnection(this.config.stub.kyselyExecuteQuery);
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
  _executeQuery: (compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }) => Promise<QueryResult<any>>;

  constructor(
    executeQuery: (compiledQuery: {
      sql: string;
      parameters: readonly unknown[];
    }) => Promise<QueryResult<any>>,
  ) {
    this._executeQuery = executeQuery;
  }

  async executeQuery<R>(compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }): Promise<QueryResult<R>> {
    log("Forwarding query to Durable Object: %s", compiledQuery.sql);

    // Call the DO's kyselyExecuteQuery method
    const result = await this._executeQuery({
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
