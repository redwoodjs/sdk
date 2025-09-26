import { PasskeyDatabase } from "./db/db.mjs";
import { migrations as passkeyMigrations } from "./db/migrations.mjs";
import { SqliteDurableObject } from "../../runtime/lib/db/index.mjs";

export class PasskeyDurableObject extends SqliteDurableObject<PasskeyDatabase> {
  migrations = passkeyMigrations;
}
