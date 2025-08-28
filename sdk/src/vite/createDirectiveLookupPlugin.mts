import MagicString from "magic-string";
import path from "path";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { hasDirective } from "./hasDirective.mjs";

// @ts-ignore
import { build } from "esbuild";

interface DirectiveLookupConfig {
  kind: "client" | "server";
  directive: "use client" | "use server";
  virtualModuleName: string;
  exportName: string;
  pluginName: string;
  optimizeForEnvironments?: string[];
  entryPoints: string[];
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

  log(
    "Initializing %s plugin with projectRootDir=%s",
    config.pluginName,
    projectRootDir,
  );

  const { metafile } = await build({
    entryPoints: config.entryPoints,
    bundle: true,
    write: false,
    metafile: true,
    absWorkingDir: projectRootDir,
    format: "esm",
  });

  const reachableFiles = Object.keys(metafile.inputs).map((p) =>
    path.join(projectRootDir, p),
  );

  for (const file of reachableFiles) {
    try {
      const content = await readFile(file, "utf-8");
      if (hasDirective(content, config.directive)) {
        const normalizedPath = normalizeModulePath(file, projectRootDir);
        files.add(normalizedPath);
      }
    } catch (error) {
      log("Skipping file during directive scan (could not read): %s", file);
    }
  }

  log(
    "Completed esbuild scan. Found %d %s files.",
    files.size,
    config.directive,
  );
  process.env.VERBOSE &&
    log("Found files for %s: %j", config.directive, Array.from(files));

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

      if (shouldOptimizeForEnv) {
        log("Applying optimizeDeps and aliasing for environment: %s", env);

        viteConfig.optimizeDeps ??= {};
        viteConfig.optimizeDeps.include ??= [];
        viteConfig.optimizeDeps.entries ??= [];

        const packagesToInclude = new Set<string>();

        for (const file of files) {
          if (file.includes("node_modules")) {
            const parts = file.split("/");
            const packageName = parts[1].startsWith("@")
              ? `${parts[1]}/${parts[2]}`
              : parts[1];
            packagesToInclude.add(packageName);
          } else {
            // For app code, we still add the individual files as entries so that
            // Vite's dev server is aware of them and they can be served.
            const actualFilePath = path.join(projectRootDir, file);
            if (Array.isArray(viteConfig.optimizeDeps.entries)) {
              viteConfig.optimizeDeps.entries.push(actualFilePath);
            } else if (viteConfig.optimizeDeps.entries) {
              viteConfig.optimizeDeps.entries = [
                viteConfig.optimizeDeps.entries,
                actualFilePath,
              ];
            } else {
              viteConfig.optimizeDeps.entries = [actualFilePath];
            }
          }
        }

        for (const pkg of packagesToInclude) {
          viteConfig.optimizeDeps.include.push(pkg);
        }

        log("Environment configuration complete for env=%s", env);
      } else {
        log("Skipping optimizeDeps and aliasing for environment: %s", env);
      }
    },
    resolveId(source) {
      process.env.VERBOSE && log("Resolving id=%s", source);

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
