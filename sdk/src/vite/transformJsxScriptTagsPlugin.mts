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
  name: "rwsdk:transform-jsx-script-tags",
  apply: "build",
  async transform(code) {
    const jsxScriptSrcRE =
      /(jsx|jsxDEV)\("script",\s*{[^}]*src:\s*["']([^"']+)["']/g;
    const jsxLinkPreloadRE =
      /(jsx|jsxDEV)\("link",\s*{[^}]*(?:href:\s*["']([^"']+)["'][^}]*rel:\s*["'](preload|modulepreload)["']|rel:\s*["'](preload|modulepreload)["'][^}]*href:\s*["']([^"']+)["'])/g;

    const scriptMatches = Array.from(code.matchAll(jsxScriptSrcRE));
    const linkMatches = Array.from(code.matchAll(jsxLinkPreloadRE));

    if (scriptMatches.length === 0 && linkMatches.length === 0) {
      return;
    }

    const manifest = await readManifest(manifestPath);
    const s = new MagicString(code);

    // Transform script src attributes
    for (const match of scriptMatches) {
      const src = match[2].slice("/".length);
      if (manifest[src]) {
        const transformedSrc = manifest[src].file;
        s.replaceAll(src, transformedSrc);
      }
    }

    // Transform link href attributes
    for (const match of linkMatches) {
      const href = (match[2] || match[5]).slice("/".length);
      if (manifest[href]) {
        const transformedHref = manifest[href].file;
        s.replaceAll(href, transformedHref);
      }
    }

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  },
});
