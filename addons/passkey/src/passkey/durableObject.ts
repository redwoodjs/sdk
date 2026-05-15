import { SqliteDurableObject } from "rwsdk/db";
import { PasskeyDatabase } from "./db/db";
import { migrations as passkeyMigrations } from "./db/migrations";

export class PasskeyDurableObject extends SqliteDurableObject<PasskeyDatabase> {
  migrations = passkeyMigrations;
}
