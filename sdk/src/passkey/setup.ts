import { RouteMiddleware } from "../../router/index.mjs";
import { requestInfo } from "../../runtime/worker.mjs";
import { ErrorResponse } from "../../runtime/worker.mjs";
import {
  createDefaultPasskeyDb,
  createDefaultSessionStore,
} from "./defaults.mjs";

export function setupPasskeyAuth(options) {
  const passkeyDb = options?.passkeyDb ?? createDefaultPasskeyDb();
  const sessions = options?.sessions ?? createDefaultSessionStore();

  const setupPasskeyAuthMiddleware: RouteMiddleware = async () => {
    const { ctx, request } = requestInfo;
    const {
      response: { headers },
    } = requestInfo;

    requestInfo.rw = { ...requestInfo.rw, passkeyDb, sessions };

    try {
      ctx.session = await sessions.load(request);
    } catch (error) {
      if (error instanceof ErrorResponse && error.code === 401) {
        await sessions.remove(request, headers);
        headers.set("Location", "/auth/login");

        throw new Response(null, {
          status: 302,
          headers,
        });
      }

      throw error;
    }
  };

  return setupPasskeyAuthMiddleware;
}
