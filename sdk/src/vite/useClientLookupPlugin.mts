import MagicString from "magic-string";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import { normalizeModulePath } from "./normalizeModulePath.mjs";

export const findFilesContainingUseClient = async ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}) => {
  const files = await glob("**/*.{ts,tsx,js,jsx,mjs,mts}", {
    cwd: projectRootDir,
    absolute: true,
  });

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
          if (
            trimmedLine.startsWith('"use client"') ||
            trimmedLine.startsWith("'use client'")
          ) {
            clientFiles.add(normalizeModulePath(projectRootDir, file));
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
};

export const useClientLookupPlugin = async ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}): Promise<Plugin> => {
  await findFilesContainingUseClient({
    projectRootDir,
    clientFiles,
  });

  return {
    name: `rwsdk:use-client-lookup`,
    configEnvironment(env, config) {
      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];
      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "rwsdk:use-client-lookup",
        setup(build) {
          build.onResolve({ filter: /^virtual:use-client-lookup$/ }, () => {
            return {
              path: "virtual:use-client-lookup",
              external: true,
            };
          });
        },
      });
    },
    resolveId(source) {
      if (source === "virtual:use-client-lookup") {
        return source;
      }
    },
    load(id) {
      if (id === "virtual:use-client-lookup") {
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
        return {
          code: s.toString(),
          map: s.generateMap(),
        };
      }
    },
  };
};
