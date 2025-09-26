export { PasskeyDurableObject } from "./durableObject.js";
export { passkeyMigrations } from "./db/migrations.js";
export { setupPasskeyAuth } from "./setup.js";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  startPasskeyLogin,
  finishPasskeyLogin,
} from "./functions.mjs";

export { SessionDurableObject } from "../../runtime/lib/auth/session.mjs";

export type { User } from "./db/index.mjs";
export type { Session } from "../../runtime/lib/auth/session.mjs";
