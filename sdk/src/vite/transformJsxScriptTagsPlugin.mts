import MagicString from "magic-string";
import { type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";

const manifestCache = new Map<string, Promise<any>>();

const readManifest = async (manifestPath: string) => {
  if (!manifestCache.has(manifestPath)) {
    manifestCache.set(
      manifestPath,
      (await pathExists(manifestPath))
        ? readFile(manifestPath, "utf-8").then(JSON.parse)
        : Promise.resolve({})
    );
  }
  return manifestCache.get(manifestPath)!;
};

export const transformJsxScriptTagsPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => ({
  name: "rw-sdk-transform-jsx-script-tags",
  apply: "build",
  async transform(code) {
    // Simpler regex that just looks for the import statement inside script children
    const scriptImportRE = /children:\s*'import\("([^"]+)"\)'/g;

    const matches = [...code.matchAll(scriptImportRE)];

    if (!matches.length) {
      return;
    }

    const manifest = await readManifest(manifestPath);
    const s = new MagicString(code);

    for (const match of matches) {
      const src = match[1].slice("./".length); // Remove leading ./
      if (manifest[src]) {
        const transformedSrc = manifest[src].file;
        s.replaceAll(`import("${match[1]}")`, `import("/${transformedSrc}")`);
      }
    }

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  },
});
