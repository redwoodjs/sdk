import { Kysely } from "kysely";
import { requestInfo } from "../../requestInfo/worker.js";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { type SqliteDurableObject } from "./index.js";

const moduleLevelDbCache = new Map<string, Kysely<any>>();

const createDurableObjectDb = <T>(
  durableObjectBinding: DurableObjectNamespace<SqliteDurableObject>,
  name = "main",
): Kysely<T> => {
  const durableObjectId = durableObjectBinding.idFromName(name);
  const stub = durableObjectBinding.get(durableObjectId);
  stub.initialize();

  return new Kysely<T>({
    dialect: new DOWorkerDialect({ stub }) as any,
  });
};

export function createDb<T>(
  durableObjectBinding: any,
  name = "main",
): Kysely<T> {
  const getDb = () => {
    // requestInfo is available
    if (requestInfo.rw) {
      if (!requestInfo.rw.databases) {
        requestInfo.rw.databases = new Map();
      }

      let db = requestInfo.rw.databases.get(name);

      // db is in requestInfo cache
      if (db) {
        return db;
      }

      // db is in module-level cache
      const moduleDb = moduleLevelDbCache.get(name);
      if (moduleDb) {
        requestInfo.rw.databases.set(name, moduleDb);
        moduleLevelDbCache.delete(name);
        return moduleDb;
      }

      // db is not in any cache
      db = createDurableObjectDb<T>(durableObjectBinding, name);
      requestInfo.rw.databases.set(name, db);
      return db;
    }

    // requestInfo is not available, use module-level cache
    let db = moduleLevelDbCache.get(name);
    if (!db) {
      db = createDurableObjectDb<T>(durableObjectBinding, name);
      moduleLevelDbCache.set(name, db);
    }
    return db;
  };

  return new Proxy({} as Kysely<T>, {
    get(target, prop) {
      const db = getDb();
      const value = db[prop as keyof Kysely<T>];

      if (typeof value === "function") {
        return value.bind(db);
      }

      return value;
    },
  });
}
