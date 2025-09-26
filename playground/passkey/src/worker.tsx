import { defineApp } from "rwsdk/worker";
import { render } from "rwsdk/router";
import {
  setupPasskeyAuth,
  PasskeyDurableObject,
  SessionDurableObject,
} from "rwsdk/passkey/worker";
import type { Session, User } from "rwsdk/passkey/worker";

import { Document } from "./app/Document.js";
import { routes } from "./app/pages/routes.js";
import { setCommonHeaders } from "./app/headers.js";

export { PasskeyDurableObject, SessionDurableObject };

export interface AppContext {
  user?: User;
  session?: Session;
}

const passkeyAuth = setupPasskeyAuth();

export default defineApp([
  setCommonHeaders(),
  passkeyAuth,
  render(Document, routes),
]);
