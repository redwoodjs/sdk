import { Kysely } from "kysely";
import { requestInfo } from "../../requestInfo/worker.js";
import { DOWorkerDialect } from "./DOWorkerDialect.js";

const createDurableObjectDb = <T>(
  durableObjectBinding: any,
  name = "main",
): Kysely<T> => {
  const durableObjectId = durableObjectBinding.idFromName(name);
  const stub = durableObjectBinding.get(durableObjectId);
  return new Kysely<T>({
    dialect: new DOWorkerDialect({ stub }) as any,
  });
};

export function createDb<T>(
  durableObjectBinding: any,
  name = "main",
): Kysely<T> {
  const cacheKey = `${durableObjectBinding}_${name}`;

  return new Proxy({} as Kysely<T>, {
    get(target, prop, receiver) {
      let db = requestInfo.rw.databases.get(cacheKey);

      if (!db) {
        db = createDurableObjectDb<T>(durableObjectBinding, name);
        requestInfo.rw.databases.set(cacheKey, db);
      }

      const value = db[prop as keyof Kysely<T>];

      if (typeof value === "function") {
        return value.bind(db);
      }

      return value;
    },
  });
}
