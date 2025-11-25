import { Kysely } from "kysely";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { type SqliteDurableObject } from "./SqliteDurableObject.js";
import { TypeConverters } from "./typeConverters.js";

export type CreateDbOptions = {
  typeConverters?: TypeConverters;
};

export function createDb<DatabaseType>(
  durableObjectBinding: DurableObjectNamespace<any>,
  name = "main",
  options: CreateDbOptions = {},
): Kysely<DatabaseType> {
  return new Kysely({
    dialect: new DOWorkerDialect({
      kyselyExecuteQuery: (...args) => {
        const durableObjectId = durableObjectBinding.idFromName(name);

        // context(justinvdm, 2 Oct 2025): First prize would be a type parameter
        // for the durable object and then use it for `durableObjectBinding`'s
        // type, rather than casting like this. However, that would prevent
        // users from being able to do createDb<InferredDbType> then though.
        const stub = (
          durableObjectBinding as DurableObjectNamespace<SqliteDurableObject>
        ).get(durableObjectId);

        stub.initialize();
        return stub.kyselyExecuteQuery(...args);
      },
      typeConverters: options.typeConverters,
    }),
  });
}
