import { DurableObject } from "cloudflare:workers";
import { Kysely } from "kysely";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { Database } from "./typeInference/database.js";

type MigrationsFromDurableObjectClass<
  DurableObjectClass extends DurableObject,
> =
  DurableObjectClass extends SqliteDurableObject<infer DB>
    ? DB["migrations"]
    : never;

export function createDb<DatabaseDurableObject extends DurableObject>(
  durableObjectBinding: DurableObjectNamespace<DatabaseDurableObject>,
  name = "main",
): Kysely<Database<MigrationsFromDurableObjectClass<DatabaseDurableObject>>> {
  return new Kysely<Database>({
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
