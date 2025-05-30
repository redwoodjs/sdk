import MagicString from "magic-string";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import debug from "debug";
import { normalizeModulePath } from "./normalizeModulePath.mjs";

const log = debug("rwsdk:vite:use-client-lookup-plugin");
const verboseLog = debug("verbose:rwsdk:vite:use-client-lookup-plugin");

export const findFilesContainingUseClient = async ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}) => {
  log(
    "Starting search for 'use client' files in projectRootDir=%s",
    projectRootDir,
  );

  const files = await glob("**/*.{ts,tsx,js,jsx,mjs,mts}", {
    cwd: projectRootDir,
    absolute: true,
  });

  log("Found %d files to scan for 'use client' directive", files.length);

  for (const file of files) {
    try {
      verboseLog("Scanning file: %s", file);
      const content = await readFile(file, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
          if (
            trimmedLine.startsWith('"use client"') ||
            trimmedLine.startsWith("'use client'")
          ) {
            const normalizedPath = normalizeModulePath(projectRootDir, file);
            log(
              "Found 'use client' directive in file: %s -> %s",
              file,
              normalizedPath,
            );
            clientFiles.add(normalizedPath);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }

  log("Completed scan. Found %d client files total", clientFiles.size);
};

export const useClientLookupPlugin = async ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}): Promise<Plugin> => {
  log(
    "Initializing use client lookup plugin with projectRootDir=%s",
    projectRootDir,
  );

  await findFilesContainingUseClient({
    projectRootDir,
    clientFiles,
  });

  return {
    name: `rwsdk:use-client-lookup`,
    configEnvironment(env, config) {
      log("Configuring environment: env=%s", env);

      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];
      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "rwsdk:use-client-lookup",
        setup(build) {
          log("Setting up esbuild plugin for virtual:use-client-lookup");
          build.onResolve({ filter: /^virtual:use-client-lookup$/ }, () => {
            verboseLog(
              "Esbuild onResolve: marking virtual:use-client-lookup as external",
            );
            return {
              path: "virtual:use-client-lookup",
              external: true,
            };
          });
        },
      });

      log("Environment configuration complete for env=%s", env);
    },
    resolveId(source) {
      verboseLog("Resolving id=%s", source);

      if (source === "virtual:use-client-lookup") {
        log("Resolving virtual:use-client-lookup module");
        return source;
      }

      verboseLog("No resolution for id=%s", source);
    },
    load(id) {
      verboseLog("Loading id=%s", id);

      if (id === "virtual:use-client-lookup") {
        log(
          "Loading virtual:use-client-lookup module with %d client files",
          clientFiles.size,
        );

        const s = new MagicString(`
export const useClientLookup = {
  ${Array.from(clientFiles)
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
