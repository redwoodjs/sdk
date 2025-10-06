import { env } from "cloudflare:workers";

export const defineScript =
  (fn: ({ env }: { env: Env }) => Promise<unknown>) => () =>
    fn({ env: env as Env });
