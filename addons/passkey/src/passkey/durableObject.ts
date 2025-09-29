import { Database } from "./db/db";
import { migrations as passkeyMigrations } from "./db/migrations";
import { SqliteDurableObject } from "rwsdk/db";

export class PasskeyDurableObject extends SqliteDurableObject<Database> {
  migrations = passkeyMigrations;
}
