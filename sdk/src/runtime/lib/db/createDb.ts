import { Kysely } from "kysely";
import { DOWorkerDialect } from "./DOWorkerDialect.js";

export function createDb<
  T,
  DurableObjectBinding extends
    DurableObjectNamespace<any> = DurableObjectNamespace<any>,
>(durableObjectBinding: DurableObjectBinding, name = "main"): Kysely<T> {
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
