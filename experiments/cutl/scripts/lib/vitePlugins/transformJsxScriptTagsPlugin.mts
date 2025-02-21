import MagicString from "magic-string";
import { type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import memoize from "lodash/memoize";
import { pathExists } from "fs-extra";

const readManifest = memoize(async (manifestPath: string) => {
  return (await pathExists(manifestPath))
    ? readFile(manifestPath, "utf-8").then(JSON.parse)
    : {};
});

export const transformJsxScriptTagsPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => ({
  name: "rw-sdk-transform-jsx-script-tags",
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
