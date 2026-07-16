import "@cloudflare/workers-types";

declare module "rwsdk/worker" {
  export interface Context extends Record<string, never> {}
}
