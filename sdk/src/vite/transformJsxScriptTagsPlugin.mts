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

export async function transformJsxScriptTagsCode(
  code: string,
  manifest: Record<string, any>,
) {
  // First, let's extract all paths from the manifest for lookup
  const entryPaths = Object.keys(manifest);

  // No entries in the manifest, nothing to transform
  if (entryPaths.length === 0) {
    return null;
  }

  // Check if this file contains JSX
  const hasJsx = code.includes("jsx(") || code.includes("jsxDEV(");
  if (!hasJsx) {
    return null;
  }

  // Check if any entry paths are in the code
  let hasMatches = false;
  for (const path of entryPaths) {
    if (code.includes(`/${path}`)) {
      hasMatches = true;
      break;
    }
  }

  if (!hasMatches) {
    return null;
  }

  const s = new MagicString(code);

  // For each entry path, find and replace within the code
  for (const path of entryPaths) {
    const fullPath = `/${path}`;

    // Only proceed if this path is referenced in the code
    if (code.includes(fullPath)) {
      const transformedPath = `/${manifest[path].file}`;

      // Find all occurrences to replace
      let index = 0;
      while ((index = code.indexOf(fullPath, index)) !== -1) {
        s.overwrite(index, index + fullPath.length, transformedPath);
        index += fullPath.length;
      }
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
    const result = await transformJsxScriptTagsCode(code, manifest);
    return result;
  },
});
