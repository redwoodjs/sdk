import { type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";
import MagicString from "magic-string";

const jsxScriptSrcRE =
  /(jsx|jsxDEV)\("script",\s*{[^}]*src:\s*["']([^"']+)["']/g;
const jsxLinkPreloadRE =
  /(jsx|jsxDEV)\("link",\s*{[^}]*(?:href:\s*["']([^"']+)["'][^}]*rel:\s*["'](preload|modulepreload)["']|rel:\s*["'](preload|modulepreload)["'][^}]*href:\s*["']([^"']+)["'])/g;

// Use a Map to cache manifests by path
const manifestCache = new Map<string, Record<string, { file: string }>>();

const readManifest = async (
  manifestPath: string,
): Promise<Record<string, { file: string }>> => {
  if (!manifestCache.has(manifestPath)) {
    const exists = await pathExists(manifestPath);
    const content = exists
      ? JSON.parse(await readFile(manifestPath, "utf-8"))
      : {};
    manifestCache.set(manifestPath, content);
  }
  return manifestCache.get(manifestPath)!;
};

function hasJsxFunctions(text: string): boolean {
  return (
    text.includes("jsx(") || text.includes("jsxs(") || text.includes("jsxDEV(")
  );
}

export async function transformJsxScriptTagsCode(
  code: string,
  manifest: Record<string, any>,
) {
  // Quick heuristic check if there's JSX in the code
  if (!hasJsxFunctions(code)) {
    return;
  }

  const s = new MagicString(code);

  // Transform script src attributes
  for (const match of code.matchAll(jsxScriptSrcRE)) {
    const src = match[2].slice("/".length);
    if (manifest[src]) {
      const transformedSrc = manifest[src].file;
      s.replaceAll(src, transformedSrc);
    }
  }

  // Transform link href attributes
  for (const match of code.matchAll(jsxLinkPreloadRE)) {
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
}

export const transformJsxScriptTagsPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => ({
  name: "rwsdk:transform-jsx-script-tags",
  apply: "build",
  async transform(code) {
    const manifest = await readManifest(manifestPath);
    return transformJsxScriptTagsCode(code, manifest);
  },
});
