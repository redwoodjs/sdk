import { defineDurableSession } from "@redwoodjs/sdk/auth";
import { env } from "cloudflare:workers";

const IS_DEV = process.env.NODE_ENV === "development";

const getAuthSecretKey = (): string =>
  env.AUTH_SECRET_KEY ||
  (IS_DEV ? "development-secret-key-do-not-use-in-production" : undefined);

export let sessions: ReturnType<typeof createSessionStore>;

const createSessionStore = (env: Env) =>
  defineDurableSession({
    secretKey: getAuthSecretKey(),
    sessionDurableObject: env.SESSION_DURABLE_OBJECT,
  });

export const setupSessionStore = (env: Env) => {
  sessions = createSessionStore(env);
  return sessions;
};
