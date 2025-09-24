import { rwsdk } from "rwsdk/worker";
import { setupPasskeyAuth } from "rwsdk/passkey/worker";
import { routes } from "./app/pages/routes.js";
import type { Session, User } from "rwsdk/passkey/worker";

export interface AppContext {
  user?: User;
  session?: Session;
}

const passkeyAuth = setupPasskeyAuth();

export default {
  async fetch(request, env, ctx) {
    return rwsdk(request, env, ctx, {
      routes,
      middleware: [passkeyAuth],
    });
  },
};
