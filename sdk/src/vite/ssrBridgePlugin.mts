import type { Plugin, ViteDevServer } from "vite";
import debug from "debug";
import { SSR_BRIDGE_PATH } from "../lib/constants.mjs";

const log = debug("rwsdk:vite:ssr-bridge-plugin");
const verboseLog = debug("verbose:rwsdk:vite:ssr-bridge-plugin");

export const VIRTUAL_SSR_PREFIX = "virtual:rwsdk:ssr:";

export const ssrBridgePlugin = (): Plugin => {
  log(
    "Initializing SSR bridge plugin with SSR_BRIDGE_PATH=%s",
    SSR_BRIDGE_PATH,
  );

  let devServer: ViteDevServer;
  let isDev = false;

  const ssrBridgePlugin: Plugin = {
    name: "rwsdk:ssr-bridge",
    enforce: "pre",
    configureServer(server) {
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
              verboseLog(
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
      verboseLog(
        "Resolving id=%s, environment=%s, isDev=%s",
        id,
        this.environment?.name,
        isDev,
      );

      if (isDev) {
        // context(justinvdm, 27 May 2025): In dev, we need to dynamically load
        // SSR modules, so we return the virtual id so that the dynamic loading
        // can happen in load()
        if (id.startsWith(VIRTUAL_SSR_PREFIX)) {
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
        // context(justinvdm, 27 May 2025): In builds, since all SSR import chains
        // originate at SSR bridge module, we return the path to the already built
        // SSR bridge bundle - SSR env builds it, worker build tries to resolve it
        // here and uses it
        if (id === "rwsdk/__ssr_bridge" && this.environment.name === "worker") {
          log(
            "Bridge module case (build): id=%s matches rwsdk/__ssr_bridge in worker environment, returning SSR_BRIDGE_PATH=%s",
            id,
            SSR_BRIDGE_PATH,
          );
          return SSR_BRIDGE_PATH;
        }
      }

      verboseLog("No resolution for id=%s", id);
    },
    async load(id) {
      verboseLog(
        "Loading id=%s, isDev=%s, environment=%s",
        id,
        isDev,
        this.environment.name,
      );

      if (
        id.startsWith(VIRTUAL_SSR_PREFIX) &&
        this.environment.name === "worker"
      ) {
        const realId = id.slice(VIRTUAL_SSR_PREFIX.length);
        log("Virtual SSR module load: id=%s, realId=%s", id, realId);

        if (isDev) {
          log(
            "Dev mode: warming up and fetching SSR module for realPath=%s",
            realId,
          );
          await devServer?.environments.ssr.warmupRequest(realId);
          const result = await devServer?.environments.ssr.fetchModule(realId);

          if (!result) {
            return;
          }

          const code = "code" in result ? result.code : undefined;
          log("Fetched SSR module code length: %d", code?.length || 0);

          // context(justinvdm, 27 May 2025): Prefix all imports in SSR modules so that they're separate in module graph from non-SSR
          const transformedCode = `
await (async function(__vite_ssr_import__, __vite_ssr_dynamic_import__) {${code}})((id) => __vite_ssr_import__('/@id/${VIRTUAL_SSR_PREFIX}'+id), (id) => __vite_ssr_dynamic_import__('/@id/${VIRTUAL_SSR_PREFIX}'+id));
`;

          log("Transformed SSR module code length: %d", transformedCode.length);

          log("Transformed SSR module code: %s", transformedCode);

          return transformedCode;
        }
      }

      verboseLog("No load handling for id=%s", id);
    },
  };

  return ssrBridgePlugin;
};
