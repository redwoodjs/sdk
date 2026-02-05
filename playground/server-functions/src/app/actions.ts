"use server";

import { serverAction, serverQuery } from "rwsdk/worker";
import { redirectMiddleware, errorMiddleware } from "./auth";

const logger = async ({ request, args }: { request: Request; args: any[] }) => {
  console.log(`[server-function] ${request.method} ${request.url} with args:`, args);
};

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
