import { sessions } from "@/session/store";
import { RouteMiddleware } from "rwsdk/router";
import { requestInfo } from "rwsdk/worker";
import { ErrorResponse } from "rwsdk/worker";

export function setupPasskeyAuth() {
  const setupPasskeyAuthMiddleware: RouteMiddleware = async () => {
    const { ctx, request, headers } = requestInfo;

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
