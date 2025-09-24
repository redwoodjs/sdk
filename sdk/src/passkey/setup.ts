import { sessions } from "@/session/store";
import { RouteMiddleware } from "rwsdk/router";
import { requestInfo } from "rwsdk/worker";
import { ErrorResponse } from "rwsdk/worker";

export function setupPasskeyAuth() {
  const setupPasskeyAuthMiddleware: RouteMiddleware = async () => {
    const { ctx, request, headers } = requestInfo;

    // Get session
    const session = await sessions.get(request, headers);

    // If the user has a session, attach them to the context
    // and continue.
    // If the user does not have a session, redirect them to the
    // login page.
    if (session.userId) {
      ctx.user = await getUserById(session.userId);
    } else {
      await sessions.remove(request, headers);
      headers.set("Location", "/auth/login");
      return new Response(null, { status: 302, headers });
    }

    // Attach the session to the context
    ctx.session = session;
  };

  return setupPasskeyAuthMiddleware;
}
