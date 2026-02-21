"use server";

import { serverAction, serverQuery } from "rwsdk/worker";

const logger = async ({ request, args }: { request: Request; args: any[] }) => {
  console.log(`[server-function] ${request.method} ${request.url} with args:`, args);
};

const redirectInterruptor = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/redirect-success",
    },
  });
};

const badRequestInterruptor = async () => {
  return new Response("Bad Request from interruptor", { status: 400 });
};

const serverErrorInterruptor = async () => {
  return new Response("Internal Server Error from interruptor", { status: 500 });
};

// --- Queries ---

export const getGreeting = serverQuery(async (name: string) => {
  return `Hello, ${name}! (from serverQuery GET)`;
});

export const getGreetingWithInterruptors = serverQuery([
  logger,
  async (name: string) => {
    return `Hello, ${name}! (with logger interruptor)`;
  },
]);

export const getGreetingWithRedirect = serverQuery([
  redirectInterruptor,
  async () => {
    return "This should not be reached";
  },
]);

export const getGreetingWithErrorResponse = serverQuery([
  badRequestInterruptor,
  async () => {
    return "This should not be reached";
  },
]);

export const getGreetingWithPost = serverQuery(
  async (name: string) => {
    return `Hello, ${name}! (from serverQuery POST)`;
  },
  { method: "POST" },
);

// --- Actions ---

export const updateName = serverAction(async (name: string) => {
  return `Name updated to: ${name}`;
});

export const updateNameWithInterruptors = serverAction([
  logger,
  async (name: string) => {
    return `Name updated to: ${name} (with logger interruptor)`;
  },
]);

export const updateNameWithRedirect = serverAction([
  redirectInterruptor,
  async () => {
    return "This should not be reached";
  },
]);

export const updateNameWithErrorResponse = serverAction([
  serverErrorInterruptor,
  async () => {
    return "This should not be reached";
  },
]);

export default serverAction(async () => {
  return "Default action called!";
});
