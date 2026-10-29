import type { AppContext } from "../src/worker";

declare module "rwsdk/worker" {
  interface DefaultAppContext extends AppContext {}

  export type App = typeof import("../src/worker").default;
}
