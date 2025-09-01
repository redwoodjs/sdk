import MagicString from "magic-string";
import path from "path";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { pathExists } from "fs-extra";
import { stat } from "fs/promises";
import { getSrcPaths } from "../lib/getSrcPaths.js";
import { hasDirective } from "./hasDirective.mjs";
import { ViteDevServer } from "vite";

interface DirectiveLookupConfig {
  kind: "client" | "server";
  directive: "use client" | "use server";
  virtualModuleName: string;
  exportName: string;
  pluginName: string;
  optimizeForEnvironments?: string[];
}

export const findFilesContainingDirective = async ({
  projectRootDir,
  files,
  directive,
  debugNamespace,
}: {
  projectRootDir: string;
  files: Set<string>;
  directive: string;
  debugNamespace: string;
}) => {
  const log = debug(debugNamespace);

  log(
    "Starting search for '%s' files in projectRootDir=%s",
    directive,
    projectRootDir,
  );

  const filesToScan = await getSrcPaths(projectRootDir);
  log(
    "Found %d files to scan for '%s' directive",
    filesToScan.length,
    directive,
  );

  for (const file of filesToScan) {
    try {
      const stats = await stat(file);

      if (!stats.isFile()) {
        process.env.VERBOSE && log("Skipping %s (not a file)", file);
        continue;
      }

      process.env.VERBOSE && log("Scanning file: %s", file);
      const content = await readFile(file, "utf-8");

      if (hasDirective(content, directive)) {
        const normalizedPath = normalizeModulePath(file, projectRootDir);
        log(
          "Found '%s' directive in file: %s -> %s",
          directive,
          file,
          normalizedPath,
        );
        files.add(normalizedPath);
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }

  log("Completed scan. Found %d %s files total", files.size, directive);
  process.env.VERBOSE &&
    log("Found files for %s: %j", directive, Array.from(files));
};

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

  log(
    "Initializing %s plugin with projectRootDir=%s",
    config.pluginName,
    projectRootDir,
  );

  await findFilesContainingDirective({
    projectRootDir,
    files,
    directive: config.directive,
    debugNamespace,
  });

  let devServer: ViteDevServer;

  return {
    name: `rwsdk:${config.pluginName}`,
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
      log("Development mode: %s", isDev);
    },
    configureServer(server) {
      devServer = server;
    },
    async configEnvironment(env, viteConfig) {
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
                `^(${escapedVirtualModuleName}|${escapedPrefixedModuleName})\.js$`,
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
        // context(justinvdm, 16 Jun 2025): Include .js extension
        // so it goes through vite processing chain
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

        if (isDev) {
          if (config.kind === "client") {
            await devServer.rwsdk?.barrelProcessingPromises?.client;
          } else {
            await devServer.rwsdk?.barrelProcessingPromises?.ssr;
          }
        }

        const s = new MagicString(`
export const ${config.exportName} = {
  ${Array.from(files)
    .map((file: string) => {
      if (file.includes("node_modules") && isDev) {
        const barrelFileName =
          config.kind === "client"
            ? "rwsdk-client-barrel.js"
            : "rwsdk-server-barrel.js";

        const dummyPath = path.join(
          projectRootDir,
          "node_modules",
          ".vite",
          barrelFileName,
        );

        const optimizer =
          this.environment.name === "client"
            ? devServer.environments.client.depsOptimizer
            : devServer.environments.ssr.depsOptimizer;

        const barrelPath = optimizer?.metadata.optimized[dummyPath]?.file;
        if (!barrelPath) {
          // This can happen if the barrel is empty (no client/server deps).
          // Return an empty object to avoid breaking the import.
          return `
  "${file}": () => Promise.resolve({ default: {} }),
`;
        }

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
