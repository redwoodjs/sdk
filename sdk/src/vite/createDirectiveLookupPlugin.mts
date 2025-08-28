import MagicString from "magic-string";
import path from "path";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { stat } from "fs/promises";
import { getSrcPaths } from "../lib/getSrcPaths.js";
import { hasDirective } from "./hasDirective.mjs";

interface DirectiveLookupConfig {
  kind: "client" | "server";
  directive: "use client" | "use server";
  virtualModuleName: string;
  exportName: string;
  pluginName: string;
  optimizeForEnvironments?: string[];
}

export const findAppFilesContainingDirective = async ({
  projectRootDir,
  directive,
  debugNamespace,
}: {
  projectRootDir: string;
  directive: string;
  debugNamespace: string;
}) => {
  const log = debug(debugNamespace);
  const files = new Set<string>();

  log("Starting search for '%s' files in application source...", directive);

  // Note: This only scans the local app source, NOT node_modules
  const filesToScan = await getSrcPaths(projectRootDir);

  for (const file of filesToScan) {
    try {
      const stats = await stat(file);
      if (!stats.isFile()) continue;

      const content = await readFile(file, "utf-8");
      if (hasDirective(content, directive)) {
        const normalizedPath = normalizeModulePath(file, projectRootDir);
        files.add(normalizedPath);
      }
    } catch (error) {
      log("Could not read file during directive scan: %s", file);
    }
  }

  log(
    "Completed scan. Found %d %s files in app source.",
    files.size,
    directive,
  );
  return files;
};

export const createDirectiveLookupPlugin = ({
  projectRootDir,
  files,
  config,
}: {
  projectRootDir: string;
  files: Set<string>;
  config: DirectiveLookupConfig;
}): Plugin => {
  const debugNamespace = `rwsdk:vite:${config.pluginName}`;
  const log = debug(debugNamespace);
  let isDev = false;

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
    async configEnvironment(env, viteConfig) {
      log("Configuring environment: env=%s", env);

      const shouldOptimizeForEnv =
        !config.optimizeForEnvironments ||
        config.optimizeForEnvironments.includes(env);

      if (isDev && shouldOptimizeForEnv) {
        log("Guiding Vite scanner with optimizeDeps.entries for env: %s", env);

        viteConfig.optimizeDeps ??= {};
        viteConfig.optimizeDeps.entries ??= [];
        viteConfig.optimizeDeps.esbuildOptions ??= {};
        viteConfig.optimizeDeps.esbuildOptions.plugins ??= [];

        for (const file of files) {
          // We only add local app files to entries.
          // Dependencies they import will be discovered by Vite's scanner.
          if (!file.includes("node_modules")) {
            const actualFilePath = path.join(projectRootDir, file);
            if (Array.isArray(viteConfig.optimizeDeps.entries)) {
              viteConfig.optimizeDeps.entries.push(actualFilePath);
            }
          }
        }
        log("Final optimizeDeps.entries: %O", viteConfig.optimizeDeps.entries);

        viteConfig.optimizeDeps.esbuildOptions.plugins.push({
          name: `rwsdk:${config.pluginName}-resolver`,
          setup(build) {
            const escapedVirtualModuleName = config.virtualModuleName.replace(
              /[-\/\\^$*+?.()|[\]{}]/g,
              "\\$&",
            );
            const filter = new RegExp(`^${escapedVirtualModuleName}\\.js$`);

            build.onResolve({ filter }, (args) => {
              return {
                path: args.path,
                external: true,
              };
            });
          },
        });
      } else {
        log("Skipping optimizeDeps guidance for environment: %s", env);
      }
    },
    resolveId(source) {
      process.env.VERBOSE && log("Resolving id=%s", source);

      if (source === `${config.virtualModuleName}.js`) {
        log("Resolving %s module", config.virtualModuleName);
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

        const s = new MagicString(`
export const ${config.exportName} = {
  ${Array.from(files)
    .map(
      (file: string) => `
  "${file}": () => import("/${file}"),
`,
    )
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
