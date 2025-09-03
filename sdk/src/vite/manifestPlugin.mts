import { readFile } from "node:fs/promises";
import { type Plugin } from "vite";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:manifest-plugin");

const virtualModuleId = "virtual:rwsdk:manifest.js";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

export const manifestPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => {
  let isBuild = false;
  let root: string;

  return {
    name: "rwsdk:manifest",
    configResolved(config) {
      log("Config resolved, command=%s", config.command);
      isBuild = config.command === "build";
      root = config.root;
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        process.env.VERBOSE && log("Resolving virtual module id=%s", id);
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        process.env.VERBOSE && log("Loading virtual module id=%s", id);
        if (!isBuild) {
          process.env.VERBOSE && log("Not a build, returning empty manifest");
          return `export default {}`;
        }

        log("Reading manifest from %s", manifestPath);
        const manifestContent = await readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);
        const normalizedManifest: Record<string, unknown> = {};

        for (const key in manifest) {
          const normalizedKey = normalizeModulePath(key, root, {
            isViteStyle: false,
          });

          const entry = manifest[key];
          delete manifest[key];
          normalizedManifest[normalizedKey] = entry;

          entry.file = normalizeModulePath(entry.file, root, {
            isViteStyle: false,
          });

          const normalizedCss: string[] = [];

          if (entry.css) {
            for (const css of entry.css) {
              normalizedCss.push(
                normalizeModulePath(css, root, {
                  isViteStyle: false,
                }),
              );
            }

            entry.css = normalizedCss;
          }
        }

        return `export default ${JSON.stringify(normalizedManifest)}`;
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
