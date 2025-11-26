import {
    DatabaseConnection,
    Driver,
    QueryResult,
    SqliteAdapter,
    SqliteIntrospector,
    SqliteQueryCompiler,
} from "kysely";
import debug from "../debug.js";
import { TypeConverters } from "./typeConverters.js";

const log = debug("sdk:db:do-worker-dialect");

type DOWorkerDialectConfig = {
  kyselyExecuteQuery: (compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }) => Promise<QueryResult<any>>;
  typeConverters?: TypeConverters;
};

export class DOWorkerDialect {
  config: DOWorkerDialectConfig;

  constructor(config: DOWorkerDialectConfig) {
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
  config: DOWorkerDialectConfig;

  constructor(config: DOWorkerDialectConfig) {
    this.config = config;
  }

  async init() {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new DOWorkerConnection(
      this.config.kyselyExecuteQuery,
      this.config.typeConverters,
    );
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
  typeConverters?: TypeConverters;

  constructor(
    executeQuery: (compiledQuery: {
      sql: string;
      parameters: readonly unknown[];
    }) => Promise<QueryResult<any>>,
    typeConverters?: TypeConverters,
  ) {
    this._executeQuery = executeQuery;
    this.typeConverters = typeConverters;
  }

  async executeQuery<R>(compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }): Promise<QueryResult<R>> {
    log("Forwarding query to Durable Object: %s", compiledQuery.sql);

    const parameters = this.processParameters(compiledQuery.parameters);

    // Call the DO's kyselyExecuteQuery method
    const result = await this._executeQuery({
      sql: compiledQuery.sql,
      parameters,
    });

    const rows = this.processRows(result.rows);

    return { ...result, rows } as QueryResult<R>;
  }

  processParameters(parameters: readonly unknown[]) {
    if (!this.typeConverters) {
      return parameters;
    }

    return parameters.map((parameter) => {
      if (parameter === null || parameter === undefined) {
        return parameter;
      }

      const constructorName = (parameter as any).constructor?.name;
      if (
        constructorName &&
        this.typeConverters![constructorName]?.serialize
      ) {
        return this.typeConverters![constructorName].serialize!(parameter);
      }

      return parameter;
    });
  }

  processRows(rows: any[]) {
    if (!this.typeConverters || !rows || rows.length === 0) {
      return rows;
    }

    return rows.map((row) => {
      const newRow = { ...row };
      for (const key in newRow) {
        const value = newRow[key];

        for (const converterKey in this.typeConverters!) {
          const converter = this.typeConverters![converterKey];

          const matches = converter.match
            ? converter.match(key)
            : key === converterKey;

          if (matches && converter.parse) {
            newRow[key] = converter.parse(value, key);
            // We stop at the first match to avoid conflicts
            break;
          }
        }
      }
      return newRow;
    });
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
