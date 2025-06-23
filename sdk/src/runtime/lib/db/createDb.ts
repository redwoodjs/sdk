import { Kysely } from "kysely";
import { requestInfo } from "../../requestInfo/worker.js";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { type SqliteDurableObject } from "./index.js";

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
  const cacheKey = `${durableObjectBinding}_${name}`;

  const doCreateDb = () => {
    let db = requestInfo.rw.databases.get(cacheKey);

    if (!db) {
      db = createDurableObjectDb<T>(durableObjectBinding, name);
      requestInfo.rw.databases.set(cacheKey, db);
    }

    return db;
  };

  doCreateDb();

  return new Proxy({} as Kysely<T>, {
    get(target, prop, receiver) {
      const db = doCreateDb();
      const value = db[prop as keyof Kysely<T>];

      if (typeof value === "function") {
        return value.bind(db);
      }

      return value;
    },
  });
}
