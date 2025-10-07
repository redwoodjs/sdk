import type { Env } from "../worker-configuration.d.ts";

declare global {
  const env: Env;
}

export {};
