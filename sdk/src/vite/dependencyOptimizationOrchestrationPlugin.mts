import debug from "debug";
import type { Plugin, ViteDevServer } from "vite";

const log = debug("rwsdk:vite:dep-opt-orchestration-plugin");

export const dependencyOptimizationOrchestrationPlugin = (): Plugin => {
  return {
    name: "rwsdk:dependency-optimization-orchestration",
    configureServer(server: ViteDevServer) {
      // Return a function to ensure our middleware is placed after internal middlewares
      return () => {
        server.middlewares.use(function rwsdkStaleBundleErrorHandler(
          err: any,
          req: any,
          res: any,
          next: any,
        ) {
          if (
            err &&
            typeof err.message === "string" &&
            err.message.includes("new version of the pre-bundle")
          ) {
            log(
              "Caught stale pre-bundle error. Invalidating worker and SSR module graphs and suspending request.",
            );
            server.environments.worker.moduleGraph.invalidateAll();
            server.environments.ssr.moduleGraph.invalidateAll();
            // By not calling next(), we suspend the request. Vite's native HMR
            // will trigger a client reload, which will cancel this hanging
            // request and start a fresh one.
            return;
          }
          next(err);
        });
      };
    },
  };
};
