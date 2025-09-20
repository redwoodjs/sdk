import { defineApp } from "./worker";
import { env } from "cloudflare:workers";

export const defineScript = (routes: Parameters<typeof defineApp>[0]) => {
  return {
    fetch: async (request: Request, env: Env, cf: ExecutionContext) => {
      const app = defineApp(routes);

      return app.fetch(request, env, cf);
    },
  };
};
