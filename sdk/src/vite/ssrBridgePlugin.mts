import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import debug from "debug";
import { DIST_DIR } from "../lib/constants.mjs";

const log = debug("rwsdk:vite:ssr-bridge-plugin");

export const VIRTUAL_SSR_PREFIX = "virtual:rwsdk:ssr:";
export const VIRTUAL_RSC_PREFIX = "virtual:rwsdk:rsc:";

export const ssrBridgePlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  const srcSsrBridgePath = path.resolve(DIST_DIR, "ssrBridge.js");

  const distSsrBridgePath = path.resolve(
    projectRootDir,
    "dist",
    "ssr",
    "ssrBridge.js",
  );

  log(
    "Initializing SSR bridge plugin with srcSsrBridgePath=%s, distSsrBridgePath=%s",
    srcSsrBridgePath,
    distSsrBridgePath,
  );

  let devServer: ViteDevServer;
  let isDev = false;

  const ssrBridgePlugin: Plugin = {
    name: "rwsdk:ssr-bridge",
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
      if (env === "ssr") {
        config.build ??= {};

        config.build.ssr = true;

        config.build.lib = {
          ...config.build.lib,
          entry: srcSsrBridgePath,
          formats: ["es"],
          fileName: path.basename(distSsrBridgePath),
        };

        config.build.outDir = path.dirname(distSsrBridgePath);
        log(
          "SSR environment configured with entry=%s, outDir=%s",
          srcSsrBridgePath,
          path.dirname(distSsrBridgePath),
        );
      }
    },
    async resolveId(id) {
      if (process.env.VERBOSE) {
        log(
          "Resolving id=%s, environment=%s, isDev=%s",
          id,
          this.environment?.name,
          isDev,
        );
      }

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
        if (id === srcSsrBridgePath && this.environment.name === "rsc") {
          const virtualId = `${VIRTUAL_SSR_PREFIX}${srcSsrBridgePath}`;
          log(
            "Bridge module case (dev): id=%s matches srcSsrBridgePath=%s in rsc environment, returning virtual id=%s",
            id,
            srcSsrBridgePath,
            virtualId,
          );
          return virtualId;
        }
      } else {
        // context(justinvdm, 27 May 2025): In builds, since all SSR import chains
        // originate at SSR bridge module, we return the path to the already built
        // SSR bridge bundle - SSR env builds it, worker build tries to resolve it
        // here and uses it
        if (id === srcSsrBridgePath && this.environment.name === "rsc") {
          log(
            "Bridge module case (build): id=%s matches srcSsrBridgePath=%s in rsc environment, returning distSsrBridgePath=%s",
            id,
            srcSsrBridgePath,
            distSsrBridgePath,
          );
          return distSsrBridgePath;
        }
      }

      if (process.env.VERBOSE) {
        log("No resolution for id=%s", id);
      }
    },
    async load(id) {
      if (process.env.VERBOSE) {
        log("Loading id=%s, isDev=%s", id, isDev);
      }

      if (id.startsWith(VIRTUAL_SSR_PREFIX)) {
        const realPath = id.slice(VIRTUAL_SSR_PREFIX.length);
        log("Virtual SSR module load: id=%s, realPath=%s", id, realPath);

        if (isDev) {
          log(
            "Dev mode: warming up and fetching SSR module for realPath=%s",
            realPath,
          );
          await devServer?.environments.ssr.warmupRequest(realPath);
          const result =
            await devServer?.environments.ssr.fetchModule(realPath);

          const code = "code" in result ? result.code : undefined;
          log("Fetched SSR module code length: %d", code?.length || 0);

          // context(justinvdm, 27 May 2025): Prefix all imports in SSR modules so that they're separate in module graph from non-SSR
          const transformedCode = `
;(async function(__vite_ssr_import__, __vite_ssr_dynamic_import__) {${code}})(
  (id) => __vite_ssr_import__('/@id/${VIRTUAL_SSR_PREFIX}'+id),
  (id) => __vite_ssr_dynamic_import__('/@id/${VIRTUAL_SSR_PREFIX}'+id),
);
`;

          log("Transformed SSR module code length: %d", transformedCode.length);
          return transformedCode;
        }
      }

      if (process.env.VERBOSE) {
        log("No load handling for id=%s", id);
      }
    },
  };

  return ssrBridgePlugin;
};
