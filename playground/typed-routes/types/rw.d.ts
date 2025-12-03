/**
 * Circular dependency problem:
 *
 * This file augments the "rwsdk/worker" module with app-specific types.
 * However, it needs to reference types from src/worker.tsx, which creates
 * a potential circular dependency:
 *
 * - types/rw.d.ts imports from src/worker.tsx
 * - src/worker.tsx imports from "rwsdk/worker" (via defineApp)
 * - "rwsdk/worker" is augmented by types/rw.d.ts
 *
 * Solution: Use type-only imports (import type) which are erased at runtime
 * and don't create actual module dependencies, avoiding the circular reference.
 */
import type { AppContext } from "../src/worker";

declare module "rwsdk/worker" {
  interface DefaultAppContext extends AppContext {}

  // App is the type of your defineApp export in src/worker.tsx
  export type App = typeof import("../src/worker").default;
}
