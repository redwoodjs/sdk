import { defineDurableSession } from "rwsdk/auth";

export let sessions: ReturnType<typeof createSessionStore>;

const createSessionStore = (env: Env) =>
  defineDurableSession({
    sessionDurableObject: env.SESSION_DURABLE_OBJECT,
  });

export const setupSessionStore = (env: Env) => {
  sessions = createSessionStore(env);
  return sessions;
};
