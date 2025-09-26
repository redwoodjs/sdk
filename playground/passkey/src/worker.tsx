import { defineApp } from "rwsdk/worker";
import { render } from "rwsdk/router";
import {
  setupPasskeyAuth,
  PasskeyDurableObject,
  SessionDurableObject,
} from "rwsdk/passkey/worker.js";
import type { Session, User } from "rwsdk/passkey/worker.js";

import { Document } from "./app/Document.js";
import { routes } from "./app/pages/routes.js";
import { setCommonHeaders } from "./app/headers.js";
import * as passkeyDb from "./passkey/index.js";

export { PasskeyDurableObject, SessionDurableObject };

export interface AppContext {
  user?: User;
  session?: Session;
}

const passkeyAuth = setupPasskeyAuth(passkeyDb);

export default defineApp([
  setCommonHeaders(),
  passkeyAuth,
  render(Document, routes),
]);
