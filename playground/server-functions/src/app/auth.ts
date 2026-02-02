"use server";

import { RequestInfo } from "rwsdk/worker";

declare module "rwsdk/worker" {
  interface DefaultAppContext {
    request: Request;
  }
}

/**
 * Mock authentication check.
 * This is an interrupter that can be used with serverQuery or serverAction.
 */
export async function requireAuth({ ctx }: RequestInfo) {
  // Mock logic: check for a specific header
  const isAuthorized = ctx.request.headers.get("x-demo-auth") === "secret-token";

  if (!isAuthorized) {
    return new Response("Unauthorized - Missing x-demo-auth: secret-token", {
      status: 401,
      statusText: "Unauthorized",
    });
  }
}
