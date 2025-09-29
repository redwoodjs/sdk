import debug from "debug";
import { type Plugin } from "vite";

const log = debug("rwsdk:vite:manifest-plugin");

const virtualModuleId = "virtual:rwsdk:manifest.js";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

export const manifestPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  let isBuild = false;

  return {
    name: "rwsdk:vite:manifest-plugin",
    enforce: "pre",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    resolveId(id) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      if (id === resolvedVirtualModuleId) {
        if (isBuild) {
          // context(justinvdm, 28 Aug 2025): During the build, we don't have
          // the manifest yet. We insert a placeholder that the linker plugin
          // will replace in the final phase.
          log("Returning manifest placeholder for build");
          return `export default "__RWSDK_MANIFEST_PLACEHOLDER__"`;
        }

        // In dev, we can return an empty object.
        log("Not a build, returning empty manifest");
        return `export default {}`;
      }
    },
    configEnvironment(name, config) {
      if (name !== "worker" && name !== "ssr") {
        return;
      }

      log("Configuring environment: name=%s", name);

      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];
      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "rwsdk:manifest:esbuild",
        setup(build) {
          log("Setting up esbuild plugin for environment: %s", name);
          build.onResolve({ filter: /^virtual:rwsdk:manifest\.js$/ }, () => {
            log("Resolving virtual manifest module in esbuild");
            return {
              path: "virtual:rwsdk:manifest.js",
              external: true,
            };
          });
        },
      });
    },
  };
};
