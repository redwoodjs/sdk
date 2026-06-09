import { migrations } from "@/db/migrations";
import { SqliteDurableObject } from "rwsdk/db";

export class AppDurableObject extends SqliteDurableObject {
  migrations = migrations;

  // context(justinvdm, 9 Jun 2026): Used by e2e tests to trigger creation of
  // Cloudflare internal _cf_* tables (e.g. _cf_KV, _cf_METADATA) which are
  // added to the DO's SQLite when storage.put or setAlarm is used.
  async setupCfTables() {
    await this.ctx.storage.put("__test_key", "__test_value");
  }
}
