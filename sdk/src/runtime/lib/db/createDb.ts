import { Kysely } from "kysely";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { type Database } from "./index.js";
import { SqliteDurableObject } from "./SqliteDurableObject.js";

type DatabaseDurableObjectConstructor = abstract new (
  ...args: any
) => SqliteDurableObject;

type MigrationsFromDurableObject<DO extends DatabaseDurableObjectConstructor> =
  InstanceType<DO>["migrations"];

export type DatabaseFromDurableObjectNamespace<
  DatabaseDurableObject extends DatabaseDurableObjectConstructor,
> = Database<MigrationsFromDurableObject<DatabaseDurableObject>>;

type BindingFromDurableObjectClass<
  DurableObjectClass extends DatabaseDurableObjectConstructor,
> = DurableObjectClass extends abstract new (...args: any) => infer T
  ? DurableObjectNamespace<T & (Rpc.DurableObjectBranded | undefined)>
  : never;

export function createDb<
  DurableObjectClass extends DatabaseDurableObjectConstructor,
>(
  durableObjectBinding: BindingFromDurableObjectClass<DurableObjectClass>,
  name = "main",
): Kysely<Database<MigrationsFromDurableObject<DurableObjectClass>>> {
  return new Kysely({
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
