import { defineApp } from "./worker";
import { env } from "cloudflare:workers";

export const defineScript = (
  fn: ({ env }: { env: Env }) => Promise<unknown>,
) => {
  const app = defineApp([
    async () => {
      await fn({ env: env as Env });
      return new Response("Done!");
    },
  ]);

  return app;
};
