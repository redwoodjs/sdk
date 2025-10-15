import debug from "debug";
import type { Plugin, ViteDevServer } from "vite";

const log = debug("rwsdk:vite:dep-opt-orchestration-plugin");

export const dependencyOptimizationOrchestrationPlugin = (): Plugin => {
  const activeOptimizationPromises = new Set<Promise<any>>();

  function wrapOptimizer(optimizer: any) {
    const originalRegisterMissingImport = optimizer.registerMissingImport;

    optimizer.registerMissingImport = function (
      this: any,
      ...args: Parameters<typeof originalRegisterMissingImport>
    ) {
      const optimizationPromise = originalRegisterMissingImport.apply(
        this,
        args,
      );
      activeOptimizationPromises.add(optimizationPromise);

      log(
        `Optimization triggered for ${
          optimizer.config.env.name
        } environment. Pausing incoming requests. Active optimizations: ${
          activeOptimizationPromises.size
        }`,
      );

      return optimizationPromise.finally(() => {
        activeOptimizationPromises.delete(optimizationPromise);
        log(
          `Optimization finished for ${
            optimizer.config.env.name
          } environment. Resuming requests. Active optimizations: ${
            activeOptimizationPromises.size
          }`,
        );
      });
    };
  }

  return {
    name: "rwsdk:dependency-optimization-orchestration",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (activeOptimizationPromises.size > 0) {
          log(
            `Pausing request to ${req.url} until ${activeOptimizationPromises.size} optimizations finish.`,
          );
          await Promise.all([...activeOptimizationPromises]);
          log(`Resuming request to ${req.url}`);
        }
        next();
      });

      // After server is listening, find and wrap the optimizers
      // for all three environments.
      (server.environments.ssr as any).optimizer.registerMissingImport =
        wrapOptimizer(server.environments.ssr?.depsOptimizer);
      (server.environments.client as any).optimizer.registerMissingImport =
        wrapOptimizer(server.environments.client?.depsOptimizer);
      (server.environments.worker as any).optimizer.registerMissingImport =
        wrapOptimizer(server.environments.worker?.depsOptimizer);

      log("All three environment optimizers have been wrapped.");
    },
  };
};
