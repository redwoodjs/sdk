import { sessions } from "../../runtime/lib/auth/session.mjs";
import { RouteMiddleware } from "../../router/index.mjs";
import { requestInfo } from "../../runtime/worker.mjs";
import { ErrorResponse } from "../../runtime/worker.mjs";

export function setupPasskeyAuth() {
  const setupPasskeyAuthMiddleware: RouteMiddleware = async () => {
    const { ctx, request } = requestInfo;
    const {
      response: { headers },
    } = requestInfo;

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
