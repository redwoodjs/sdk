import { env } from "cloudflare:workers";
import { createDb } from "../../runtime/lib/db/index.mjs";
import { migrations } from "./defaultDb/migrations.mjs";
import * as dbMethods from "./defaultDb/dbMethods.mjs";
import type { PasskeyDatabase } from "./defaultDb/dbMethods.mjs";
import { defineDurableSession } from "../../runtime/lib/session/index.mjs";

interface CreateDefaultPasskeyDbOptions {
  durableObject: DurableObjectNamespace;
  name: string;
}

export function createDefaultPasskeyDb(
  options?: Partial<CreateDefaultPasskeyDbOptions>,
) {
  const durableObject = options?.durableObject ?? env.PASSKEY_DURABLE_OBJECT;
  const name = options?.name ?? "passkey-main";

  if (!durableObject) {
    throw new Error(
      "Passkey DB Durable Object binding not found. Please provide it in your wrangler.jsonc or pass it to createDefaultPasskeyDb.",
    );
  }

  const db = createDb<PasskeyDatabase>(durableObject, name, migrations);

  return dbMethods.createDbMethods(db);
}

interface CreateDefaultSessionStoreOptions {
  durableObject: DurableObjectNamespace;
}

export function createDefaultSessionStore(
  options?: Partial<CreateDefaultSessionStoreOptions>,
) {
  const durableObject = options?.durableObject ?? env.SESSION_DURABLE_OBJECT;

  if (!durableObject) {
    throw new Error(
      "Session DB Durable Object binding not found. Please provide it in your wrangler.jsonc or pass it to createDefaultSessionStore.",
    );
  }

  return defineDurableSession({
    sessionDurableObject: durableObject,
  });
}
