import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import path from "path";

export const findFilesContainingUseClient = async ({
  rootDir,
  containingPath,
}: {
  rootDir: string;
  containingPath: string;
}): Promise<string[]> => {
  // Get all TypeScript and TSX files in the containing path
  const files = await glob("**/*.{ts,tsx}", {
    cwd: path.resolve(rootDir, containingPath),
    absolute: true,
  });

  const clientFiles: string[] = [];

  // Check each file for 'use client' in the first non-empty line
  for (const file of files) {
    try {
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
            clientFiles.push(relativePath);
          }
          break; // Only check the first non-empty line
        }
      }
    } catch (error) {
      // Skip files that can't be read
      console.error(`Error reading file ${file}:`, error);
    }
  }

  return clientFiles;
};

export const useClientLookupPlugin = ({
  rootDir,
  containingPath,
}: {
  rootDir: string;
  containingPath: string;
}): Plugin =>
  virtualPlugin("use-client-lookup", async () => {
    const files = await findFilesContainingUseClient({
      rootDir,
      containingPath,
    });

    const s = new MagicString(`
export const useClientLookup = {
  ${files
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
