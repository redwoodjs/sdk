import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import path from "path";
import debug from "debug";

const logWorker = debug("rwsdk:vite:use-client-lookup:worker");
const logClient = debug("rwsdk:vite:use-client-lookup:client");

export const findFilesContainingUseClient = async ({
  rootDir,
  containingPath,
  environmentName,
}: {
  rootDir: string;
  containingPath: string;
  environmentName?: string;
}): Promise<string[]> => {
  const log = environmentName === "worker" ? logWorker : logClient;
  log(
    "Called findFilesContainingUseClient with rootDir: %s, containingPath: %s",
    rootDir,
    containingPath,
  );
  // Get all TypeScript and TSX files in the containing path
  const files = await glob("**/*.{ts,tsx}", {
    cwd: path.resolve(rootDir, containingPath),
    absolute: true,
  });

  const clientFiles: string[] = [];

  // Check each file for 'use client' in the first non-empty line
  for (const file of files) {
    try {
      log("Checking file: %s", file);
      const content = await readFile(file, "utf-8");
      const lines = content.split("\n");

      // Find the first non-empty line
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
          // Check if it contains the 'use client' directive
          if (
            trimmedLine.startsWith('"use client"') ||
            trimmedLine.startsWith("'use client'")
          ) {
            // Make the path relative to rootDir and add leading slash
            const relativePath = "/" + path.relative(rootDir, file);
            log(
              "Found 'use client' directive in: %s (relative: %s)",
              file,
              relativePath,
            );
            clientFiles.push(relativePath);
          }
          break; // Only check the first non-empty line
        }
      }
    } catch (error) {
      // Skip files that can't be read
      log("Error reading file %s: %O", file, error);
    }
  }

  log("Final clientFiles found: %O", clientFiles);
  return clientFiles;
};

export const useClientLookupPlugin = ({
  rootDir,
  containingPaths,
}: {
  rootDir: string;
  containingPaths: string[];
}): Plugin =>
  virtualPlugin("use-client-lookup", async function () {
    let files: string[] = [];
    for (const containingPath of containingPaths) {
      const found = await glob("**/*.{ts,tsx}", {
        cwd: path.resolve(rootDir, containingPath),
        absolute: true,
      });
      files.push(...found);
    }

    const environmentName = this?.environment?.name;
    const clientFiles = await findFilesContainingUseClient({
      rootDir,
      containingPath: containingPaths[0],
      environmentName,
    });

    const s = new MagicString(`
export const useClientLookup = {
  ${clientFiles
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
  });
