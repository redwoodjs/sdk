import MagicString from "magic-string";
import path from "path";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import debug from "debug";
import { normalizeModulePath } from "./normalizeModulePath.mjs";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

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

        for (const file of files) {
          if (file.includes("/node_modules/")) {
            verboseLog("Adding to optimizeDeps.include: %s -> %s", file);
            viteConfig.optimizeDeps.include.push(file);
          } else {
            verboseLog("Skipping non-node_modules file: %s", file);
          }
        }

        const aliases = ensureAliasArray(viteConfig);

        for (const file of files) {
          const actualFilePath = path.join(projectRootDir, file);
          const findRegex = new RegExp(
            `^${file.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
          );
          aliases.push({ find: findRegex, replacement: actualFilePath });
          log("Added alias for env=%s: %s -> %s", env, file, actualFilePath);
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
    load(id) {
      verboseLog("Loading id=%s", id);

      if (id === config.virtualModuleName) {
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
  "${file}": () => import("${file}"),
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
