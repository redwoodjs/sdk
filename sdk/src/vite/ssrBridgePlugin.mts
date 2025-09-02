import type { Plugin, ViteDevServer } from "vite";
import debug from "debug";
import { findSsrImportCallSites } from "./findSsrSpecifiers.mjs";
import { INTERMEDIATE_SSR_BRIDGE_PATH } from "../lib/constants.mjs";
import MagicString from "magic-string";

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

              if (args.path === "rwsdk/__ssr_bridge") {
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
    async resolveId(id) {
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
        // context(justinvdm, 2 Sep 2025): In builds, we resolve to the path
        // of the intermediate SSR bridge build. Since we're no longer treating
        // it as external, Vite will bundle it directly into the worker.
        if (id === "rwsdk/__ssr_bridge" && this.environment.name === "worker") {
          log(
            "Bridge module case (build): id=%s matches rwsdk/__ssr_bridge in worker environment, resolving to intermediate path=%s",
            id,
            INTERMEDIATE_SSR_BRIDGE_PATH,
          );
          return { id: INTERMEDIATE_SSR_BRIDGE_PATH, external: false };
        }
      }
    },
    async load(id) {
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
          const result =
            await devServer?.environments.ssr.fetchModule(idForFetch);

          process.env.VERBOSE &&
            log("Fetch module result: id=%s, result=%O", idForFetch, result);

          const code = "code" in result ? result.code : undefined;

          if (
            idForFetch.endsWith(".css") &&
            !idForFetch.endsWith(".module.css")
          ) {
            process.env.VERBOSE &&
              log("Plain CSS file, returning empty module for %s", idForFetch);
            return "export default {};";
          }

          log("Fetched SSR module code length: %d", code?.length || 0);

          const s = new MagicString(code || "");
          const callsites = findSsrImportCallSites(idForFetch, code || "", log);

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
    },
  };

  return ssrBridgePlugin;
};
