"use server";

import { serverAction, serverQuery } from "rwsdk/worker";

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

export default serverAction([
  logger,
  async () => {
    return "Default action called!";
  },
]);
