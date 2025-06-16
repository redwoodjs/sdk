import MagicString from "magic-string";
import path from "path";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import debug from "debug";
import { normalizeModulePath } from "./normalizeModulePath.mjs";
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
  const verboseLog = debug(`verbose:${debugNamespace}`);

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
        verboseLog("Skipping %s (not a file)", file);
        continue;
      }

      verboseLog("Scanning file: %s", file);
      const content = await readFile(file, "utf-8");

      if (hasDirective(content, directive)) {
        const normalizedPath = normalizeModulePath(projectRootDir, file);
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
  verboseLog("Found files for %s: %j", directive, Array.from(files));
};

const resolveOptimizedDep = async (
  projectRootDir: string,
  id: string,
  environment: string,
  debugNamespace: string,
): Promise<string | undefined> => {
  const log = debug(debugNamespace);
  const verboseLog = debug(`verbose:${debugNamespace}`);

  try {
    const depsDir = environment === "client" ? "deps" : `deps_${environment}`;
    const nodeModulesDepsDirPath = path.join("node_modules", ".vite", depsDir);
    const depsDirPath = path.join(projectRootDir, nodeModulesDepsDirPath);
    const manifestPath = path.join(depsDirPath, "_metadata.json");
    log("Checking for manifest at: %s", manifestPath);

    const manifestExists = await pathExists(manifestPath);
    if (!manifestExists) {
      log("Manifest not found at %s", manifestPath);
      return undefined;
    }

    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    if (manifest.optimized && manifest.optimized[id]) {
      const optimizedFile = manifest.optimized[id].file;
      const optimizedPath = path.join(
        "/",
        nodeModulesDepsDirPath,
        optimizedFile,
      );

      log(
        "Found optimized dependency: filePath=%s, optimizedPath=%s",
        id,
        optimizedPath,
      );
      return optimizedPath;
    }

    verboseLog("File not found in optimized dependencies: id=%s", id);
    return undefined;
  } catch (error) {
    verboseLog("Error resolving optimized dependency for id=%s: %s", id, error);
    return undefined;
  }
};

const addOptimizedDepsEntries = async ({
  projectRootDir,
  directive,
  environment,
  debugNamespace,
  files,
}: {
  projectRootDir: string;
  directive: string;
  environment: string;
  debugNamespace: string;
  files: Set<string>;
}) => {
  const log = debug(debugNamespace);
  const verboseLog = debug(`verbose:${debugNamespace}`);

  try {
    const depsDir = environment === "client" ? "deps" : `deps_${environment}`;
    const depsDirPath = path.join(
      projectRootDir,
      "node_modules",
      ".vite",
      depsDir,
    );
    const manifestPath = path.join(depsDirPath, "_metadata.json");
    verboseLog("Checking for manifest at: %s", manifestPath);

    const manifestExists = await pathExists(manifestPath);
    if (!manifestExists) {
      verboseLog("Manifest not found at %s", manifestPath);
      return;
    }

    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    for (const entryId of Object.keys(manifest.optimized)) {
      if (entryId.startsWith("/node_modules/")) {
        const srcPath = manifest.optimized[entryId].src;
        const resolvedSrcPath = path.resolve(
          projectRootDir,
          "node_modules",
          ".vite",
          "deps",
          srcPath,
        );
        let contents: string;
        try {
          contents = await readFile(resolvedSrcPath, "utf-8");
        } catch (error) {
          verboseLog("Error reading file %s: %s", resolvedSrcPath, error);
          continue;
        }

        if (hasDirective(contents, directive)) {
          log("Adding optimized entry to files: %s", entryId);
          files.add(entryId);
        } else {
          log(
            "Skipping optimized entry %s because it does not contain the '%s' directive",
            entryId,
            directive,
          );
        }
      }
    }
  } catch (error) {
    verboseLog("Error adding optimized deps entries: %s", error);
  }
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
  const verboseLog = debug(`verbose:${debugNamespace}`);
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

      // Add optimized deps entries that match our pattern
      await addOptimizedDepsEntries({
        projectRootDir,
        files,
        directive: config.directive,
        environment: env,
        debugNamespace,
      });

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
                `^(${escapedVirtualModuleName}|${escapedPrefixedModuleName})$`,
              ),
            },
            () => {
              verboseLog(
                "Esbuild onResolve: marking %s as external",
                config.virtualModuleName,
              );
              return {
                path: config.virtualModuleName,
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
          const actualFilePath = path.join(projectRootDir, file);

          verboseLog("Adding to optimizeDeps.entries: %s", actualFilePath);
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
      verboseLog("Resolving id=%s", source);

      if (
        source === config.virtualModuleName ||
        source === `/@id/${config.virtualModuleName}`
      ) {
        log("Resolving %s module", config.virtualModuleName);
        // context(justinvdm, 16 Jun 2025): Include .js extension
        // so it goes through vite processing chain
        return config.virtualModuleName + ".js";
      }

      verboseLog("No resolution for id=%s", source);
    },
    async load(id) {
      verboseLog("Loading id=%s", id);

      if (id === config.virtualModuleName + ".js") {
        log(
          "Loading %s module with %d files",
          config.virtualModuleName,
          files.size,
        );

        const environment = this.environment?.name || "client";
        log("Current environment: %s, isDev: %s", environment, isDev);

        const optimizedDeps: Record<string, string> = {};

        if (isDev && devServer) {
          for (const file of files) {
            const resolvedPath = await resolveOptimizedDep(
              projectRootDir,
              file,
              environment,
              debugNamespace,
            );
            if (resolvedPath) {
              optimizedDeps[file] = resolvedPath;
            }
          }
        }

        const s = new MagicString(`
export const ${config.exportName} = {
  ${Array.from(files)
    .map(
      (file: string) => `
  "${file}": () => import("${optimizedDeps[file] ?? file}"),
`,
    )
    .join("")}
};
`);

        const code = s.toString();
        const map = s.generateMap();

        log("Generated virtual module code length: %d", code.length);
        verboseLog("Generated virtual module code: %s", code);

        return {
          code,
          map,
        };
      }

      verboseLog("No load handling for id=%s", id);
    },
  };
};
