"use server";

import { serverAction, serverQuery } from "rwsdk/worker";
import { requireAuth } from "./auth";

const logger = async ({ request, args }: { request: Request; args: any[] }) => {
  console.log(`[server-function] ${request.method} ${request.url} with args:`, args);
};

export const getGreeting = serverQuery([
  logger,
  async (name: string) => {
    return `Hello, ${name}! (from serverQuery GET)`;
  },
]);

export const getSecretData = serverQuery([
  requireAuth,
  async () => {
    return "This is top secret data only visible with 'x-demo-auth: secret-token' header!";
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

export default serverAction([
  logger,
  async () => {
    return "Default action called!";
  },
]);
