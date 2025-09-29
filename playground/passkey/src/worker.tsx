import { defineApp, render } from "rwsdk/app";
import { setupPasskeyAuth } from "rwsdk/passkey/worker";
import {
  PasskeyDurableObject,
  SessionDurableObject,
} from "rwsdk/passkey/worker";
import { type Session } from "rwsdk/auth";

import { Document } from "./app/Document.js";
import { routes } from "./app/pages/routes.js";
import { setCommonHeaders } from "./app/headers.js";

export { PasskeyDurableObject, SessionDurableObject };

export interface AppContext {
  session?: Session;
}

const passkeyAuth = setupPasskeyAuth();

export default defineApp([
  setCommonHeaders(),
  passkeyAuth,
  render(Document, routes),
]);
