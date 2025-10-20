import debug from "debug";
import MagicString from "magic-string";
import type { Plugin, ViteDevServer } from "vite";
import { INTERMEDIATE_SSR_BRIDGE_PATH } from "../lib/constants.mjs";
import { findSsrImportCallSites } from "./findSsrSpecifiers.mjs";

const log = debug("rwsdk:vite:ssr-bridge-plugin");

export const VIRTUAL_SSR_PREFIX = "virtual:rwsdk:ssr:";

export const ssrBridgePlugin = ({
  clientFiles,
  serverFiles,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  let devServer: ViteDevServer;
  let isDev = false;

  const ssrBridgePlugin: Plugin = {
    name: "rwsdk:ssr-bridge",
    enforce: "pre",
    configureServer(server) {
      devServer = server;

      const ssrHot = server.environments.ssr.hot;
      const originalSsrHotSend = ssrHot.send;
      ssrHot.send = (...args: any[]) => {
        for (const envName of ["worker", "ssr"] as const) {
          const moduleGraph = server.environments[envName]!.moduleGraph;
          moduleGraph.invalidateAll();
          //moduleGraph.urlToModuleMap.clear();
          //moduleGraph.idToModuleMap.clear();
          //moduleGraph.fileToModulesMap.clear();
          //(moduleGraph as any)._unresolvedUrlToModuleMap.clear();
        }

        if (typeof args[0] === "object" && args[0].type === "full-reload") {
          log("SSR full-reload detected, propagating to worker");
          server.environments.worker.hot.send.apply(
            server.environments.worker.hot,
            args as any,
          );
        }

        return originalSsrHotSend.apply(ssrHot, args as any);
      };

      log("Configured dev server");
      const originalRun = devServer.environments.ssr.depsOptimizer?.run!;

      devServer.environments.ssr.depsOptimizer!.run = async () => {
        originalRun();
        devServer.environments.worker.depsOptimizer!.run!();
      };
    },
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
      log(
        "Config: command=%s, isPreview=%s, isDev=%s",
        command,
        isPreview,
        isDev,
      );
    },
    configEnvironment(env, config) {
      log("Configuring environment: env=%s", env);

      if (env === "worker") {
        // Configure esbuild to mark rwsdk/__ssr paths as external for worker environment
        log("Configuring esbuild options for worker environment");
        config.optimizeDeps ??= {};
        config.optimizeDeps.esbuildOptions ??= {};
        config.optimizeDeps.esbuildOptions.plugins ??= [];
        config.optimizeDeps.include ??= [];

        config.optimizeDeps.esbuildOptions.plugins.push({
          name: "rwsdk-ssr-external",
          setup(build) {
            log(
              "Setting up esbuild plugin to mark rwsdk/__ssr paths as external for worker",
            );
            build.onResolve({ filter: /.*$/ }, (args) => {
              process.env.VERBOSE &&
                log(
                  "Esbuild onResolve called for path=%s, args=%O",
                  args.path,
                  args,
                );

              if (
                args.path === "rwsdk/__ssr_bridge" ||
                args.path.startsWith(VIRTUAL_SSR_PREFIX)
              ) {
                log("Marking as external: %s", args.path);
                return {
                  path: args.path,
                  external: true,
                };
              }
            });
          },
        });

        log("Worker environment esbuild configuration complete");
      }
    },
    async resolveId(id, importer) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      console.log(`[RWS-VITE-RESOLVE-LOG] id: ${id}`);

      if (isDev) {
        // context(justinvdm, 27 May 2025): In dev, we need to dynamically load
        // SSR modules, so we return the virtual id so that the dynamic loading
        // can happen in load()
        if (id.startsWith(VIRTUAL_SSR_PREFIX)) {
          if (id.endsWith(".css")) {
            const newId = id + ".js";
            log(
              "Virtual CSS module, adding .js suffix. old: %s, new: %s",
              id,
              newId,
            );
            return newId;
          }

          log("Returning virtual SSR id for dev: %s", id);
          return id;
        }

        // context(justinvdm, 28 May 2025): The SSR bridge module is a special case -
        // it is the entry point for all SSR modules, so to trigger the
        // same dynamic loading logic as other SSR modules (as the case above),
        // we return a virtual id
        if (id === "rwsdk/__ssr_bridge" && this.environment.name === "worker") {
          const virtualId = `${VIRTUAL_SSR_PREFIX}${id}`;
          log(
            "Bridge module case (dev): id=%s matches rwsdk/__ssr_bridge in worker environment, returning virtual id=%s",
            id,
            virtualId,
          );

          return virtualId;
        }
      } else {
        // In build mode, the behavior depends on the build pass
        if (id.startsWith(VIRTUAL_SSR_PREFIX)) {
          if (this.environment.name === "worker") {
            log(
              "Virtual SSR module case (build-worker pass): resolving to external",
            );
            return { id, external: true };
          }
        }

        if (id === "rwsdk/__ssr_bridge" && this.environment.name === "worker") {
          if (process.env.RWSDK_BUILD_PASS === "worker") {
            // First pass: resolve to a temporary, external path
            log(
              "Bridge module case (build-worker pass): resolving to external path",
            );
            return { id: INTERMEDIATE_SSR_BRIDGE_PATH, external: true };
          } else if (process.env.RWSDK_BUILD_PASS === "linker") {
            // Second pass (linker): resolve to the real intermediate build
            // artifact so it can be bundled in.
            log(
              "Bridge module case (build-linker pass): resolving to bundleable path",
            );
            return { id: INTERMEDIATE_SSR_BRIDGE_PATH, external: false };
          }
        }
      }
    },
    async load(id) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      if (
        id.startsWith(VIRTUAL_SSR_PREFIX) &&
        this.environment.name === "worker"
      ) {
        const realId = id.slice(VIRTUAL_SSR_PREFIX.length);
        const idForFetch = realId.endsWith(".css.js")
          ? realId.slice(0, -3)
          : realId;

        log(
          "Virtual SSR module load: id=%s, realId=%s, idForFetch=%s",
          id,
          realId,
          idForFetch,
        );

        if (isDev) {
          // from the SSR environment, which is crucial for things like server
          // components.
          return (async () => {
            const ssrOptimizer = devServer.environments.ssr.depsOptimizer;

            let idForFetch = realId;

            // context(justinvdm, 20 Oct 2025): This is the fix for the stale
            // dependency issue. The root cause is the "unhashed-to-hashed"
            // transition. Our worker code imports a clean ID
            // (`rwsdk/__ssr_bridge`), but we expect to fetch the hashed,
            // optimized version from the SSR environment. When a re-optimization
            // happens, Vite's `fetchModule` (running in the SSR env) finds a
            // "ghost node" in its module graph for the clean ID and incorrectly
            // re-uses its stale, hashed `id` property.
            //
            // To fix this, we manually resolve the hashed path here, before
            // asking the SSR env to process the module. We look into the SSR
            // optimizer's metadata to find the correct, up-to-date hash and
            // construct the path ourselves. This ensures the SSR env is
            // always working with the correct, versioned ID, bypassing the
            // faulty ghost node lookup.
            if (
              ssrOptimizer &&
              Object.prototype.hasOwnProperty.call(
                ssrOptimizer.metadata.optimized,
                realId,
              )
            ) {
              const depInfo = ssrOptimizer.metadata.optimized[realId]!;
              idForFetch = ssrOptimizer.getOptimizedDepId(depInfo);
              log(
                "Manually resolved %s to hashed path for fetchModule: %s",
                realId,
                idForFetch,
              );
            }

            log(
              "Virtual SSR module load: id=%s, realId=%s, idForFetch=%s",
              id,
              realId,
              idForFetch,
            );

            log("Dev mode: fetching SSR module for realPath=%s", idForFetch);

            try {
              // We use `fetchModule` with `cached: false` as a safeguard. Since
              // we're in a `load` hook, we know the worker-side cache for this
              // virtual module is stale. `cached: false` ensures that we also
              // bypass any potentially stale transform result in the SSR
              // environment's cache, guaranteeing we get the freshest possible
              // code.
              const result = await devServer.environments.ssr.fetchModule(
                idForFetch,
                undefined,
                { cached: false },
              );

              if ("code" in result) {
                log(
                  "Fetched SSR module code length: %d",
                  result.code?.length || 0,
                );

                const code = result.code;

                if (
                  idForFetch.endsWith(".css") &&
                  !idForFetch.endsWith(".module.css")
                ) {
                  process.env.VERBOSE &&
                    log(
                      "Plain CSS file, returning empty module for %s",
                      idForFetch,
                    );
                  return "export default {};";
                }

                const s = new MagicString(code || "");
                const callsites = findSsrImportCallSites(
                  idForFetch,
                  code || "",
                  log,
                );

                for (const site of callsites) {
                  const normalized = site.specifier.startsWith("/@id/")
                    ? site.specifier.slice("/@id/".length)
                    : site.specifier;
                  // context(justinvdm, 11 Aug 2025):
                  // - We replace __vite_ssr_import__ and __vite_ssr_dynamic_import__
                  //   with import() calls so that the module graph can be built
                  //   correctly (vite looks for imports and import()s to build module
                  //   graph)
                  // - We prepend /@id/$VIRTUAL_SSR_PREFIX to the specifier so that we
                  //   can stay within the SSR subgraph of the worker module graph
                  const replacement = `import("/@id/${VIRTUAL_SSR_PREFIX}${normalized}")`;
                  s.overwrite(site.start, site.end, replacement);
                }

                const out = s.toString();
                process.env.VERBOSE &&
                  log(
                    "Transformed SSR module code for realId=%s: %s",
                    realId,
                    out,
                  );
                return {
                  code: out,
                  map: null, // Sourcemaps are handled by fetchModule's inlining
                };
              } else {
                // This case can be hit if the module is already cached. We may
                // need to handle this more gracefully, but for now we'll just
                // return an empty module.
                log(
                  "SSR module %s was already cached. Returning empty.",
                  idForFetch,
                );
                return "export default {}";
              }
            } catch (e) {
              log(
                "Error fetching SSR module for realPath=%s: %s",
                idForFetch,
                e,
              );
              throw e;
            }
          })();
        }
      }

      return;
    },
  };

  return ssrBridgePlugin;
};
