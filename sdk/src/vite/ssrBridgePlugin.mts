import debug from "debug";
import MagicString from "magic-string";
import type { Plugin, ViteDevServer } from "vite";
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
    configureServer(server: ViteDevServer) {
      devServer = server;
      log("Configured dev server");

      // Intercept the `send` method on the SSR environment's HMR channel.
      // We need to do this because `hot.on()` is for listening to inbound
      // client events, but we need to intercept outbound server events.
      const ssrHot = server.environments.ssr.hot;
      const originalSend = ssrHot.send;

      // @ts-expect-error - we are monkey-patching `send`
      ssrHot.send = (...args: Parameters<typeof originalSend>) => {
        const payload = args[0] as unknown as any;

        if (typeof payload === "object" && payload.type === "full-reload") {
          log(
            "Intercepted `full-reload` in SSR environment, propagating to worker",
          );
          server.environments.worker.moduleGraph.invalidateAll();
          //server.environments.ssr.moduleGraph.invalidateAll();
          server.environments.worker.hot.send(payload);
        }

        return originalSend.apply(ssrHot, args);
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
    async resolveId(source, importer, options) {
      if (!isDev) {
        return;
      }

      // Proactively prevent stale bridge errors by stripping the hash
      // before the module is loaded.
      if (source.includes("deps_ssr/rwsdk___ssr_bridge")) {
        const [basePath] = source.split("?");
        log(
          "SSR Bridge dependency detected. Stripping version hash. Original: %s, Stripped: %s",
          source,
          basePath,
        );
        // Return a resolved module to bypass the default resolution
        return await this.resolve(basePath, importer, {
          ...options,
          skipSelf: true,
        });
      }

      if (
        source === "rwsdk/__ssr_bridge" &&
        this.environment.name === "worker"
      ) {
        const virtualId = `${VIRTUAL_SSR_PREFIX}${source}`;
        log(
          "Bridge module case (dev): id=%s matches rwsdk/__ssr_bridge in worker environment, returning virtual id=%s",
          source,
          virtualId,
        );

        return virtualId;
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

        // In dev, we need to use the dev server's `fetchModule` to get the
        // transformed and resolved module.
        if (isDev) {
          log("Dev mode: fetching SSR module for realPath=%s", idForFetch);
          try {
            const ssrOptimizer = devServer?.environments.ssr.depsOptimizer;
            if (ssrOptimizer) {
              // @ts-expect-error - _metadata is private
              const browserHash = ssrOptimizer._metadata?.browserHash;
              log("SSR depsOptimizer browserHash: %s", browserHash);
            }

            const result = await devServer?.environments.ssr.fetchModule(
              idForFetch,
              undefined,
              { cached: false },
            );

            if (result) {
              let code = result.code;

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

              log("Fetched SSR module code length: %d", code?.length || 0);

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
              log("Transformed SSR module code length: %d", out.length);
              process.env.VERBOSE &&
                log(
                  "Transformed SSR module code for realId=%s: %s",
                  realId,
                  out,
                );
              return { code, map: result.map };
            }
          } catch (e) {
            log("Error fetching SSR module: %o", e);
            throw e;
          }
        } else {
          // In prod, we resolve the module to its real path on disk.
          const resolved = await this.resolve(idForFetch, undefined, {
            skipSelf: true,
          });
          if (resolved) {
            return resolved.id;
          }
        }
      }
    },
  };

  return ssrBridgePlugin;
};
