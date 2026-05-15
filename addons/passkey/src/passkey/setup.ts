import { sessions } from "@/session/store";
import { RouteMiddleware } from "rwsdk/router";
import { ErrorResponse, requestInfo } from "rwsdk/worker";

export function setupPasskeyAuth() {
  const setupPasskeyAuthMiddleware: RouteMiddleware = async () => {
    const { ctx, request, response } = requestInfo;

    try {
      ctx.session = await sessions.load(request);
    } catch (error) {
      if (error instanceof ErrorResponse && error.code === 401) {
        await sessions.remove(request, response.headers);
        response.headers.set("Location", "/auth/login");

        throw new Response(null, {
          status: 302,
          headers: response.headers,
        });
      }

      throw error;
    }
  };

  return setupPasskeyAuthMiddleware;
}
