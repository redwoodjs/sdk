import { defineDurableSession } from "@redwoodjs/sdk/auth";

export let sessions: ReturnType<typeof defineDurableSession>;

export const setupSessionStore = (env: Env) => {
  sessions = defineDurableSession({
    secretKey: env.SECRET_KEY,
    sessionDurableObject: env.SESSION_DO,
  });

  return sessions;
};
