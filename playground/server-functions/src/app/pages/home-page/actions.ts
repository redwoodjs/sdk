"use server";

import { serverAction, serverQuery } from "rwsdk/worker";
import { requestInfo } from "rwsdk/worker";


const logger = async ({ request, args }: { request: Request; args: any[] }) => {
  console.log(`[server-function] ${request.method} ${request.url} with args:`, args);
};

export async function redirectMiddleware() {
  const url = new URL("/redirect?source=redirect-middleware", requestInfo.request.url);
  return Response.redirect(url.toString(), 303);
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


export const getGreeting = serverQuery([
  logger,
  async (name: string) => {
    return `Hello, ${name}! (from serverQuery GET)`;
  },
]);

export const getGreetingPost = serverQuery(
  [
    logger,
    async (name: string) => {
      return `Hello, ${name}! (from serverQuery POST)`;
    },
  ],
  { method: "POST" },
);

export const updateName = serverAction([
  logger,
  async (name: string) => {
    return `Greeting updated to: Hello, ${name}! (from serverAction POST)`;
  },
]);

export const getRedirectQuery = serverQuery([
  logger,
  redirectMiddleware,
  async () => {
    return "This should not be reached due to redirect in middleware";
  },
]);

export const getErrorQuery = serverQuery([
  logger,
  errorMiddleware,
  async () => {
    return "This should not be reached due to error in middleware";
  },
]);

export const getRedirectAction = serverAction([
  logger,
  redirectMiddleware,
  async () => {
    return "This should not be reached due to redirect in middleware";
  },
]);

export const getErrorAction = serverAction([
  logger,
  errorMiddleware,
  async () => {
    return "This should not be reached due to error in middleware";
  },
]);
