import { RouteMiddleware } from "../runtime/lib/router.js";
import { requestInfo } from "../runtime/requestInfo/worker.js";
import { ErrorResponse } from "../runtime/error.js";

interface SetupPasskeyAuthOptions {
  passkeyDb: any;
  sessionStore?: any;
}

export function setupPasskeyAuth({
  db,
  sessionStore,
}: SetupPasskeyAuthOptions) {
  const setupPasskeyAuthMiddleware: RouteMiddleware = async () => {
    const { ctx, request } = requestInfo;
    const {
      response: { headers },
    } = requestInfo;

    requestInfo.rw = { ...requestInfo.rw, passkeyDb };

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
