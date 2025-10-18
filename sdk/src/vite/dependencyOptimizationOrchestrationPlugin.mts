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
          if (
            err &&
            typeof err.message === "string" &&
            err.message.includes("new version of the pre-bundle")
          ) {
            log(
              "Caught stale pre-bundle error. Resetting, waiting, and redirecting.",
            );

            // Hard reset
            server.environments.worker.moduleGraph.invalidateAll();
            server.environments.ssr.moduleGraph.invalidateAll();

            // Wait for server to stabilize
            await new Promise((r) => setTimeout(r, 2000));

            // Redirect to retry the request
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
