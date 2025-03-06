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
        : Promise.resolve({}),
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
    const jsxScriptSrcRE =
      /(jsx|jsxDEV)\("script",\s*{[^}]*src:\s*["']([^"']+)["'][^}]/g;

    const matches = [...code.matchAll(jsxScriptSrcRE)];

    if (!matches.length) {
      return;
    }

    const manifest = await readManifest(manifestPath);
    const s = new MagicString(code);

    for (const match of matches) {
      const src = match[2].slice("/".length);

      if (manifest[src]) {
        const transformedSrc = manifest[src].file;
        s.replaceAll(src, transformedSrc);
      }
    }

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  },
});
