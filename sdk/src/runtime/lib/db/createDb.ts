import { Kysely } from "kysely";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { type SqliteDurableObject } from "./index.js";

export function createDb<T, DurableObject extends SqliteDurableObject>(
  durableObjectBinding: DurableObjectNamespace<DurableObject>,
  name = "main",
): Kysely<T> {
  return new Kysely<T>({
    dialect: new DOWorkerDialect({
      kyselyExecuteQuery: (...args) => {
        const durableObjectId = durableObjectBinding.idFromName(name);
        const stub = durableObjectBinding.get(durableObjectId);
        stub.initialize();
        return stub.kyselyExecuteQuery(...args);
      },
    }),
  });
}
