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

      // Invalidate the worker's module graph and propagate the HMR event to clear the runner's cache
      // when the SSR environment triggers a full reload (e.g. after dep optimization).
      const ssrHotSend = server.environments.ssr.hot.send;
      server.environments.ssr.hot.send = (...args: any) => {
        const payload = args[0];
        if (typeof payload === "object" && payload.type === "full-reload") {
          log(
            "Intercepted `full-reload` in SSR environment. Invalidating worker module graph and propagating event.",
          );
          // Invalidate the transform cache for the worker
          server.environments.worker.moduleGraph.invalidateAll();
          // Propagate the HMR event to clear the runner's execution cache
          server.environments.worker.hot.send(
            ...(args as unknown as Parameters<
              typeof server.environments.worker.hot.send
            >),
          );
        }

        // We don't call the original `send` because there's no client connected to the SSR HMR channel.
        // It's a no-op that just logs a debug message.
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
      }
    },
    async resolveId(source, importer, options) {
      if (!isDev) {
        return;
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
      console.log(`[RWS-SSR-BRIDGE] load hook called for id: ${id}`);
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      if (
        id.startsWith(VIRTUAL_SSR_PREFIX) &&
        this.environment.name === "worker"
      ) {
        console.log(`[RWS-SSR-BRIDGE] Identified virtual SSR module: ${id}`);
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

        let metadata;
        if (isDev) {
          log("Dev mode: fetching SSR module for realPath=%s", idForFetch);
          // @ts-expect-error
          globalThis.__RWS_FRESH_DEPS_OPTIMIZER__ =
            devServer?.environments.ssr.depsOptimizer;
          try {
            // The whole point of this plugin is to load the module from the SSR environment
            const ssrOptimizer = devServer?.environments.ssr.depsOptimizer;
            if (ssrOptimizer) {
              const browserHash = ssrOptimizer.metadata?.browserHash;
              console.log(
                `[RWS-SSR-BRIDGE] SSR depsOptimizer browserHash: ${browserHash}`,
              );
              metadata = JSON.stringify(ssrOptimizer.metadata);
            }

            console.log(
              `[RWS-SSR-BRIDGE] Fetching module from SSR environment: ${idForFetch}`,
            );
            const result = await devServer?.environments.ssr.fetchModule(
              idForFetch,
              undefined,
              { cached: false },
            );

            if (result) {
              const code = "code" in result ? result.code : undefined;

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
              return { code: out, map: (result as any).map };
            }
          } catch (e) {
            console.error(
              `[RWS-SSR-BRIDGE] Error fetching SSR module for id: ${id}`,
              e,
              metadata,
            );
            throw e;
          } finally {
            // @ts-expect-error
            delete globalThis.__RWS_FRESH_DEPS_OPTIMIZER__;
          }
        }
      }
    },
  };

  return ssrBridgePlugin;
};
