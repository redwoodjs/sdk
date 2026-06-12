import MagicString from "magic-string";
import type { Plugin } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { findExports } from "./findSpecifiers.mjs";
import { hasDirective } from "./hasDirective.mjs";

const directiveRegex = /^(\s*)(['"]use client['"])\s*;?\s*\n?/m;

export const hasServerPassthroughClientExport = (id: string, code: string) => {
  const exports = findExports(id, code);

  return exports.some((exportInfo) => {
    if (exportInfo.isDefault) {
      return false;
    }

    const name = exportInfo.name || exportInfo.originalName;
    return !!name && /^[a-z]/.test(name);
  });
};

export const viteRscClientReferencePassthroughPlugin = ({
  clientFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  projectRootDir: string;
}): Plugin => ({
  name: "rwsdk:vite-rsc-client-reference-passthrough",
  enforce: "pre",
  transform(code, id) {
    if (this.environment?.name !== "worker") {
      return null;
    }

    const normalizedId = normalizeModulePath(id, projectRootDir);
    if (
      !clientFiles.has(normalizedId) ||
      !hasDirective(code, "use client") ||
      !hasServerPassthroughClientExport(normalizedId, code)
    ) {
      return null;
    }

    const match = directiveRegex.exec(code);
    if (!match) {
      return null;
    }

    const s = new MagicString(code);
    s.remove(match.index, match.index + match[0].length);

    return {
      code: s.toString(),
      map: s.generateMap({
        source: normalizedId,
        includeContent: true,
        hires: true,
      }),
    };
  },
});
