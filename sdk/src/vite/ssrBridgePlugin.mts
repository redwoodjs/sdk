import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { DIST_DIR } from "../lib/constants.mjs";

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

  let devServer: ViteDevServer;
  let isDev = false;

  const ssrBridgePlugin: Plugin = {
    name: "rwsdk:ssr-bridge",
    configureServer(server) {
      devServer = server;
    },
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
    },
    configEnvironment(env, config) {
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
      }
    },
    async resolveId(id) {
      if (isDev) {
        // context(justinvdm, 27 May 2025): In dev, we need to dynamically load
        // SSR modules, so we return the virtual id so that the dynamic loading
        // can happen in load()
        if (id.startsWith(VIRTUAL_SSR_PREFIX)) {
          return id;
        }

        // context(justinvdm, 28 May 2025): The SSR bridge module is a special case -
        // it is the entry point for all SSR modules, so to trigger the
        // same dynamic loading logic as other SSR modules (as the case above),
        // we return a virtual id
        if (id === srcSsrBridgePath && this.environment.name === "rsc") {
          return `${VIRTUAL_SSR_PREFIX}${srcSsrBridgePath}`;
        }
      } else {
        // context(justinvdm, 27 May 2025): In builds, since all SSR import chains
        // originate at SSR bridge module, we return the path to the already built
        // SSR bridge bundle - SSR env builds it, worker build tries to resolve it
        // here and uses it
        if (id === srcSsrBridgePath && this.environment.name === "rsc") {
          return distSsrBridgePath;
        }
      }
    },
    async load(id) {
      if (id.startsWith(VIRTUAL_SSR_PREFIX)) {
        const realPath = id.slice(VIRTUAL_SSR_PREFIX.length);

        if (isDev) {
          await devServer?.environments.ssr.warmupRequest(realPath);
          const result =
            await devServer?.environments.ssr.fetchModule(realPath);

          const code = "code" in result ? result.code : undefined;

          // context(justinvdm, 27 May 2025): Prefix all imports in SSR modules so that they're separate in module graph from non-SSR
          const transformedCode = `
;(async function(__vite_ssr_import__, __vite_ssr_dynamic_import__) {${code}})(
  (id) => __vite_ssr_import__('/@id/${VIRTUAL_SSR_PREFIX}'+id),
  (id) => __vite_ssr_dynamic_import__('/@id/${VIRTUAL_SSR_PREFIX}'+id),
);
`;

          return transformedCode;
        }
      }
    },
  };

  return ssrBridgePlugin;
};
