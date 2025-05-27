import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { DIST_DIR } from "../lib/constants.mjs";

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
      console.log("################## resolveId", id);

      if (id.startsWith("virtual:ssr:") && isDev) {
        // context(justinvdm, 26 May 2025): In dev, we want to dynamically load the bridge
        // via the SSR environment. In build, we want to use the already built bridge.
        console.log(
          "################## reached resolveId() virtual:ssr: in dev for environment",
          this.environment.name,
          id,
        );
        return id;
      }

      if (id === "virtual:ssr:/src/ssrBridge.ts" && !isDev) {
        console.log(
          "################## reached load() virtual:ssrBridge for build in environment",
          this.environment.name,
        );
        return distSsrBridgePath;
      }
    },
    async load(id) {
      console.log("################## load", id, this.environment.name);

      if (id.startsWith("virtual:ssr:")) {
        const realPath = id.slice("virtual:ssr:".length);

        if (isDev) {
          await devServer?.environments.ssr.warmupRequest(realPath);
          const result =
            await devServer?.environments.ssr.fetchModule(realPath);

          const code = "code" in result ? result.code : undefined;
          const transformedCode = `
;(async function(__vite_ssr_import__, __vite_ssr_dynamic_import__) {
${code}
})(
  (id) => console.log('### runtime import for %s', id) || __vite_ssr_import__('/@id/virtual:ssr:'+id),
  (id) => console.log('### runtime dynamic import for %s', id) || __vite_ssr_dynamic_import__('/@id/virtual:ssr:'+id),
);
`;
          console.log(
            `################## reached load() ssr virtual path ${realPath} in environment ${this.environment.name}, fetched and transformed code:`,
          );

          console.log(transformedCode);

          return transformedCode;
        }
      }
    },
  };

  return ssrBridgePlugin;
};
