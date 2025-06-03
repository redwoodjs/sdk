import MagicString from "magic-string";
import path from "path";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import debug from "debug";
import { normalizeModulePath } from "./normalizeModulePath.mjs";
import { ensureAliasArray } from "./ensureAliasArray.mjs";
import { pathExists } from "fs-extra";

interface DirectiveLookupConfig {
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

  const allFiles = await glob("**/*.{ts,tsx,js,jsx,mjs,mts}", {
    cwd: projectRootDir,
    absolute: true,
  });

  log("Found %d files to scan for '%s' directive", allFiles.length, directive);

  for (const file of allFiles) {
    try {
      verboseLog("Scanning file: %s", file);
      const content = await readFile(file, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
          if (
            trimmedLine.startsWith(`"${directive}"`) ||
            trimmedLine.startsWith(`'${directive}'`)
          ) {
            const normalizedPath = normalizeModulePath(projectRootDir, file);
            log(
              "Found '%s' directive in file: %s -> %s",
              directive,
              file,
              normalizedPath,
            );
            files.add(normalizedPath);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }

  log("Completed scan. Found %d %s files total", files.size, directive);
};

const resolveOptimizedDep = async (
  projectRootDir: string,
  filePath: string,
  environment: string,
  debugNamespace: string,
): Promise<string | undefined> => {
  const log = debug(debugNamespace);
  const verboseLog = debug(`verbose:${debugNamespace}`);

  try {
    const getDepsDir = (env: string) =>
      env === "client" ? "deps" : `deps_${env}`;

    const getManifestPath = (env: string) =>
      path.join(
        projectRootDir,
        "node_modules",
        ".vite",
        getDepsDir(env),
        "_metadata.json",
      );

    const getOptimizedPath = (env: string, fileName: string) =>
      path.join("/", "node_modules", ".vite", getDepsDir(env), fileName);

    const manifestPath = getManifestPath(environment);
    verboseLog("Checking for manifest at: %s", manifestPath);

    const manifestExists = await pathExists(manifestPath);
    if (!manifestExists) {
      verboseLog("Manifest not found at %s", manifestPath);
      return undefined;
    }

    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    if (manifest.optimized && manifest.optimized[filePath]) {
      const optimizedFile = manifest.optimized[filePath].file;
      const optimizedPath = getOptimizedPath(environment, optimizedFile);

      log("Found optimized dependency: %s -> %s", filePath, optimizedPath);
      return optimizedPath;
    }

    verboseLog("File %s not found in optimized dependencies", filePath);
    return undefined;
  } catch (error) {
    verboseLog(
      "Error resolving optimized dependency for %s: %s",
      filePath,
      error,
    );
    return undefined;
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

  return {
    name: `rwsdk:${config.pluginName}`,
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
      log("Development mode: %s", isDev);
    },
    configEnvironment(env, viteConfig) {
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

        const aliases = ensureAliasArray(viteConfig);

        for (const file of files) {
          const actualFilePath = path.join(projectRootDir, file);

          if (file.includes("/node_modules/")) {
            verboseLog("Adding to optimizeDeps.include: %s -> %s", file);
            viteConfig.optimizeDeps.include.push(file);

            const findRegex = new RegExp(
              `^${file.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
            );
            aliases.push({ find: findRegex, replacement: actualFilePath });
            verboseLog(
              "Added alias for `node_modules` module matching directive in env=%s: %s -> %s",
              env,
              file,
              actualFilePath,
            );
          }
        }

        log(
          "Environment configuration complete for env=%s with %d optimizeDeps includes and %d aliases",
          env,
          Array.from(files).filter((f) => f.includes("/node_modules/")).length,
          files.size,
        );
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
        return config.virtualModuleName;
      }

      verboseLog("No resolution for id=%s", source);
    },
    async load(id) {
      verboseLog("Loading id=%s", id);

      if (id === config.virtualModuleName) {
        log(
          "Loading %s module with %d files",
          config.virtualModuleName,
          files.size,
        );

        const environment = this.environment?.name || "client";
        log("Current environment: %s, isDev: %s", environment, isDev);

        const optimizedDeps: Record<string, string> = {};

        if (isDev) {
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
