import MagicString from "magic-string";
import path from "path";
import { Plugin, ViteDevServer } from "vite";
import { readFile } from "fs/promises";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { stat } from "fs/promises";
import { getSrcPaths } from "../lib/getSrcPaths.js";
import { hasDirective } from "./hasDirective.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";

interface DirectiveLookupConfig {
  kind: "client" | "server";
  directive: "use client" | "use server";
  virtualModuleName: string;
  exportName: string;
  pluginName: string;
  optimizeForEnvironments?: string[];
}

export const createDirectiveLookupPlugin = async ({
  projectRootDir,
  files,
  config,
}: {
  projectRootDir: string;
  files: Set<string>;
  config: DirectiveLookupConfig;
}): Promise<Plugin> => {
  const debugNamespace = `rwsdk:vite:${config.pluginName}`;
  const log = debug(debugNamespace);
  let isDev = false;
  let devServer: ViteDevServer;

  log(
    "Initializing %s plugin with projectRootDir=%s",
    config.pluginName,
    projectRootDir,
  );

  return {
    name: `rwsdk:${config.pluginName}`,
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
      log("Development mode: %s", isDev);
    },
    configureServer(server) {
      devServer = server;
    },
    configEnvironment(env, viteConfig) {
      if (
        !isDev &&
        process.env.RWSDK_BUILD_PASS &&
        process.env.RWSDK_BUILD_PASS !== "worker"
      ) {
        return;
      }
      log("Configuring environment: env=%s", env);

      viteConfig.optimizeDeps ??= {};
      viteConfig.optimizeDeps.esbuildOptions ??= {};
      viteConfig.optimizeDeps.esbuildOptions.plugins ??= [];
      viteConfig.optimizeDeps.esbuildOptions.plugins.push({
        name: `rwsdk:${config.pluginName}`,
        setup(build) {
          log("Setting up esbuild plugin for %s", config.virtualModuleName);

          // Handle both direct virtual module name and /@id/ prefixed version
          const escapedVirtualModuleName = config.virtualModuleName.replace(
            /[-\/\\^$*+?.()|[\]{}]/g,
            "\\$&",
          );
          const escapedPrefixedModuleName =
            `/@id/${config.virtualModuleName}`.replace(
              /[-\/\\^$*+?.()|[\]{}]/g,
              "\\$&",
            );

          build.onResolve(
            {
              filter: new RegExp(
                `^(${escapedVirtualModuleName}|${escapedPrefixedModuleName})\\.js$`,
              ),
            },
            () => {
              process.env.VERBOSE &&
                log(
                  "Esbuild onResolve: marking %s as external",
                  config.virtualModuleName,
                );
              return {
                path: `${config.virtualModuleName}.js`,
                external: true,
              };
            },
          );
        },
      });

      const shouldOptimizeForEnv =
        !config.optimizeForEnvironments ||
        config.optimizeForEnvironments.includes(env);

      if (shouldOptimizeForEnv) {
        log("Applying optimizeDeps and aliasing for environment: %s", env);

        viteConfig.optimizeDeps.include ??= [];

        for (const file of files) {
          if (file.includes("node_modules")) {
            continue;
          }

          const actualFilePath = path.join(projectRootDir, file);

          process.env.VERBOSE &&
            log("Adding to optimizeDeps.entries: %s", actualFilePath);
          const entries = Array.isArray(viteConfig.optimizeDeps.entries)
            ? viteConfig.optimizeDeps.entries
            : ([] as string[]).concat(viteConfig.optimizeDeps.entries ?? []);
          viteConfig.optimizeDeps.entries = entries;
          entries.push(actualFilePath);
        }

        log("Environment configuration complete for env=%s", env);
      } else {
        log("Skipping optimizeDeps and aliasing for environment: %s", env);
      }
    },
    resolveId(source) {
      if (source === `${config.virtualModuleName}.js`) {
        log("Resolving %s module", config.virtualModuleName);

        if (!isDev && this.environment?.name === "worker") {
          if (process.env.RWSDK_BUILD_PASS === "worker") {
            log("Marking as external for worker pass");
            return { id: source, external: true };
          }
        }

        return source;
      }
    },
    async load(id) {
      if (id === config.virtualModuleName + ".js") {
        log(
          "Loading %s module with %d files",
          config.virtualModuleName,
          files.size,
        );

        const environment = this.environment?.name || "client";
        log("Current environment: %s, isDev: %s", environment, isDev);

        const s = new MagicString(`
export const ${config.exportName} = {
  ${Array.from(files)
    .map((file: string) => {
      if (file.includes("node_modules") && isDev) {
        const barrelPath =
          config.kind === "client"
            ? "rwsdk/__client_barrel"
            : "rwsdk/__server_barrel";

        return `
  "${file}": () => import("${barrelPath}").then(m => m.default["${file}"]),
`;
      } else {
        return `
  "${file}": () => import("${file}"),
`;
      }
    })
    .join("")}
};
`);

        const code = s.toString();
        const map = s.generateMap();

        log("Generated virtual module code length: %d", code.length);
        process.env.VERBOSE && log("Generated virtual module code: %s", code);

        return {
          code,
          map,
        };
      }
    },
  };
};
