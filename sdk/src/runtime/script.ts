import { defineApp } from "./worker";
import { env } from "cloudflare:workers";

export const defineScript = (
  fn: ({ env }: { env: Cloudflare.Env }) => Promise<unknown>,
) => {
  const app = defineApp([
    async () => {
      await fn({ env });
      return new Response("Done!");
    },
  ]);

  return app;
};
