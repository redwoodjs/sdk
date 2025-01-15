import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";
import { Plugin } from 'vite';
import { $ } from '../$.mjs';

export const findFilesContainingUseClient = async ({
  rootDir,
  containingPath,
}: {
  rootDir: string;
  containingPath: string;
}): Promise<string[]> => {
  const result = await $({
    cwd: rootDir,
    // context(justinvdm, 2024-12-05): Empty grep results will cause non-zero exit code
    reject: false,
  })`grep -rl --include=*.ts --include=*.tsx -e ${'"use client"'} -e ${"'use client'"} ${containingPath}`;

  return result.stdout
    ?.split("\n")
    .map((line: string) => line.trim().slice(1))
    .filter(Boolean) ?? [];
};

export const useClientLookupPlugin = ({
  rootDir,
  containingPath,
}: {
  rootDir: string;
  containingPath: string;
}): Plugin =>
  virtualPlugin("use-client-lookup", async () => {
    const files = await findFilesContainingUseClient({ rootDir, containingPath });

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
  })
