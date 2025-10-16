import debug from "debug";
import type { Plugin, ViteDevServer } from "vite";

const log = debug("rwsdk:vite:dep-opt-orchestration-plugin");

export const dependencyOptimizationOrchestrationPlugin = (): Plugin => {
  return {
    name: "rwsdk:dependency-optimization-orchestration",
    configureServer(server: ViteDevServer) {
      // Return a function to ensure our middleware is placed after internal middlewares
      return () => {
        server.middlewares.use(async function rwsdkStaleBundleErrorHandler(
          err: any,
          req: any,
          res: any,
          next: any,
        ) {
          // The 'stale pre-bundle' error originates from `DevEnvironment.fetchModule`.
          // When Vite re-optimizes dependencies, it creates new bundle files in
          // `node_modules/.vite/deps`. If a module is still referencing the old
          // bundle file (with the outdated `v=` hash), this error is thrown.
          // We catch it here to prevent a server crash and to diagnose which
          // module is holding onto the stale import.
          if (
            err &&
            typeof err.message === "string" &&
            err.message.includes("stale pre-bundle")
          ) {
            log("Caught stale pre-bundle error. Stack trace:");
            log(err.stack);
          }
          next(err);
        });
      };
    },
  };
};
