import { Kysely } from "kysely";
import { requestInfo } from "../../requestInfo/worker.js";
import { DOWorkerDialect } from "./SqliteDurableObject.js";

export function createDurableObjectDb<T>(
  durableObjectBinding: any,
  name = "main",
): Kysely<T> {
  const durableObjectId = durableObjectBinding.idFromName(name);
  const stub = durableObjectBinding.get(durableObjectId);

  return new Kysely<T>({
    dialect: new DOWorkerDialect({ stub }) as any,
  });
}

export function createDb<T>(
  durableObjectBinding: any,
  name = "main",
): Kysely<T> {
  // Create a cache key from the binding and name
  const cacheKey = `${durableObjectBinding}_${name}`;

  // Return a proxy that lazily creates and caches the database instance
  return new Proxy({} as Kysely<T>, {
    get(target, prop, receiver) {
      if (!(requestInfo.rw as any).databases) {
        (requestInfo.rw as any).databases = new Map();
      }

      // Check if we have a cached instance
      let db = (requestInfo.rw as any).databases.get(cacheKey);

      if (!db) {
        // Create the database instance and cache it
        db = createDurableObjectDb<T>(durableObjectBinding, name);
        (requestInfo.rw as any).databases.set(cacheKey, db);
      }

      // Forward the property access to the actual database instance
      const value = (db as any)[prop];

      // If it's a function, bind it to the database instance
      if (typeof value === "function") {
        return value.bind(db);
      }

      return value;
    },
  });
}
