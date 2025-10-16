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
    async configureServer(server) {
      devServer = server;
      log("Configured dev server");
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

        if (isDev) {
          log("Dev mode: fetching SSR module for realPath=%s", idForFetch);

          const result = await devServer?.environments.ssr.fetchModule(
            idForFetch,
            undefined,
            { cached: false },
          );

          if (result) {
            process.env.VERBOSE &&
              log("Fetch module result: id=%s, result=%O", idForFetch, result);

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
              log("Transformed SSR module code for realId=%s: %s", realId, out);
            return out;
          }
        }
      }
    },
  };

  return ssrBridgePlugin;
};
