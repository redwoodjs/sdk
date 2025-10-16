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
              "Caught stale pre-bundle error. Invalidating graphs and issuing redirect.",
            );
            server.environments.worker.moduleGraph.invalidateAll();
            server.environments.ssr.moduleGraph.invalidateAll();

            // A server-side redirect is more robust than relying on HMR.
            // The previous infinite loop with this method should be solved
            // by our proactive hash-stripping for the SSR bridge.
            res.writeHead(307, { Location: req.url });
            res.end();
            return;
          }
          next(err);
        });
      };
    },
  };
};
