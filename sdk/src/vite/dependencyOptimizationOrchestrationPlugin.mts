import debug from "debug";
import type { Plugin } from "vite";
import { VIRTUAL_SSR_PREFIX } from "./ssrBridgePlugin.mjs";

const log = debug("rwsdk:vite:dep-opt-orchestration-plugin");

export const dependencyOptimizationOrchestrationPlugin = (): Plugin => {
  return {
    name: "rwsdk:dependency-optimization-orchestration",
    configureServer(server) {
      // This hook returns a function that Vite executes after its internal
      // middlewares are configured. This is the correct way to register a
      // final, top-level error handler.
      return () => {
        server.middlewares.use(function rwsdkStaleBundleErrorHandler(
          err: any,
          req: any,
          res: any,
          next: any,
        ) {
          if (
            err.message?.includes("There is a new version of the pre-bundle")
          ) {
            log(
              "Stale pre-bundle error caught. Invalidating graphs and suspending request.",
              err.message,
            );

            // 1. Invalidate the entire SSR module graph
            server.environments.ssr.moduleGraph.invalidateAll();

            // 2. Invalidate all virtual SSR modules in the worker graph to break the loop
            const { moduleGraph: workerModuleGraph } =
              server.environments.worker;
            for (const mod of workerModuleGraph.urlToModuleMap.values()) {
              if (mod.url.includes(VIRTUAL_SSR_PREFIX)) {
                log("Invalidating worker virtual SSR module: %s", mod.url);
                workerModuleGraph.invalidateModule(mod);
              }
            }

            // 3. Explicitly invalidate the bridge module in the worker graph by its ID
            const bridgeModule =
              workerModuleGraph.getModuleById("rwsdk/__ssr_bridge");
            if (bridgeModule) {
              log("Explicitly invalidating worker ssr bridge module");
              workerModuleGraph.invalidateModule(bridgeModule);
            }

            // Suspend the response with a timeout fail-safe
            const timeout = setTimeout(() => {
              if (!res.writableEnded) {
                log("Response suspension timed out. Sending 204.");
                res.statusCode = 204;
                res.end();
              }
            }, 5000);

            // Clean up the timeout if the connection is closed prematurely
            // (e.g., by the client reloading)
            res.on("close", () => {
              clearTimeout(timeout);
            });

            return;
          }
          // Forward other errors to the default error handler
          next(err);
        });
      };
    },
  };
};
