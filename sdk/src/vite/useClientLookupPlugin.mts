import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";
import { Plugin } from "vite";
import { readFile } from "fs/promises";
import { glob } from "glob";
import path from "path";

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
            const relativePath = "/" + path.relative(projectRootDir, file);
            clientFiles.add(relativePath);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
};

export const useClientLookupPlugin = ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}): Plugin =>
  virtualPlugin("use-client-lookup", async () => {
    await findFilesContainingUseClient({
      projectRootDir,
      clientFiles,
    });

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
  });
