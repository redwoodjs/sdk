import debug from "debug";
import type { Plugin } from "vite";

const log = debug("rwsdk:vite:dep-opt-orchestration-plugin");

export const dependencyOptimizationOrchestrationPlugin = (): Plugin => {
  return {
    name: "rwsdk:dependency-optimization-orchestration",
    configureServer(server) {
      // This middleware intercepts stale pre-bundle errors and gracefully
      // aborts the request, allowing the client to retry after the HMR
      // full-reload signal.
      server.middlewares.use(async (req, res, next) => {
        try {
          await next();
        } catch (e: any) {
          if (e.message?.includes("There is a new version of the pre-bundle")) {
            console.log(
              "############ Stale pre-bundle error caught at middleware level.",
            );
            log(
              "Stale pre-bundle error caught at middleware level. Invalidating SSR graph and sending 204.",
            );
            const { moduleGraph: ssrModuleGraph } = server.environments.ssr;
            for (const mod of ssrModuleGraph.urlToModuleMap.values()) {
              ssrModuleGraph.invalidateModule(mod);
            }
            res.statusCode = 204;
            res.end();
            return;
          }
          // Forward other errors to the default error handler
          next(e);
        }
      });
    },
  };
};
