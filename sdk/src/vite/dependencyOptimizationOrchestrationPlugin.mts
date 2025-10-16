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
            err.message.includes("new version of the pre-bundle")
          ) {
            log(
              "Caught stale pre-bundle error. Invalidating all module graphs and suspending request...",
            );
            log(err.stack);

            // Invalidate all module graphs to clear stale transformed code.
            server.environments.ssr.moduleGraph.invalidateAll();
            server.environments.worker.moduleGraph.invalidateAll();
            server.environments.client.moduleGraph.invalidateAll();

            // Suspend the response to allow the client's HMR reload to take over.
            // The request will time out on the client, which is the desired
            // behavior for a request that can no longer be fulfilled.
            return;
          }
          next(err);
        });
      };
    },
  };
};
