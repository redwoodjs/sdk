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
            log("Caught stale pre-bundle error. Performing system-wide reset.");

            // Invalidate all server-side module caches.
            server.moduleGraph.invalidateAll();
            server.environments.worker.moduleGraph.invalidateAll();
            server.environments.ssr.moduleGraph.invalidateAll();

            // Broadcast a full-reload message to the worker environment. This will
            // be picked up by our HMR bridge and forwarded to the runner,
            // clearing its internal cache. Vite will also forward this to the client.
            server.environments.worker.hot.send({
              type: "full-reload",
              path: "*",
            });

            // End the request gracefully. 205 tells the client to reset the view,
            // allowing the HMR full-reload to take over.
            res.statusCode = 205;
            res.end();
            return;
          }
          next(err);
        });
      };
    },
  };
};
