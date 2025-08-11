import { Kysely } from "kysely";
import { requestInfo, waitForRequestInfo } from "../../requestInfo/worker.js";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { type SqliteDurableObject } from "./index.js";
import { env } from "cloudflare:workers";

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
  // context(justinvdm, 11 Aug 2025): We fall back to this map if we're not in a
  // request context. For example, if `createDb` is called in a handler other
  // than `fetch`, such as `queue`. It'll only ever store a single instance of
  // the db.
  const singletonDbInstanceMap = new Map();

  const getOrCreateDb = () => {
    const instanceMap = requestInfo.rw?.databases ?? singletonDbInstanceMap;
    let db = instanceMap.get(name);

    if (!db) {
      db = createDurableObjectDb<T>(durableObjectBinding, name);
      instanceMap.set(name, db);
    }

    return db;
  };

  return new Proxy({} as Kysely<T>, {
    get(target, prop, receiver) {
      const db = getOrCreateDb();
      const value = db[prop as keyof Kysely<T>];

      if (typeof value === "function") {
        return value.bind(db);
      }

      return value;
    },
  });
}
