import { setupDb } from "./db"

export const defineScript = (fn: ({ env }: { env?: Env }) => Promise<unknown>) => {
  return {
    async fetch(request: Request, env: Env) {
      setupDb(env);
      await fn({ env });
      return new Response('Done!')
    },
  };
};
