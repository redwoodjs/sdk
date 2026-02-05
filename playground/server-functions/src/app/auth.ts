"use server";

import { RequestInfo } from "rwsdk/worker";

declare module "rwsdk/worker" {
  interface DefaultAppContext {
    request: Request;
  }
}

/**
 * Middleware that demonstrates a redirect.
 */
export async function redirectMiddleware() {
  return Response.redirect("https://google.com");
}

/**
 * Middleware that demonstrates returning an error.
 */
export async function errorMiddleware() {
  return new Response("This is a deliberate error from middleware!", {
    status: 400,
    headers: { "Content-Type": "text/plain" },
  });
}
