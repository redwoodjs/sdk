import { Lang, parse as sgParse } from "@ast-grep/napi";
import debug from "debug";
import MagicString from "magic-string";
import type { Plugin } from "vite";

const log = debug("rwsdk:vite:ssr-bridge-wrap");

export const ssrBridgeWrapPlugin = (): Plugin => {
  return {
    name: "rwsdk:ssr-bridge-wrap",
    apply: "build",
    renderChunk(code, chunk) {
      try {
        if (!chunk.fileName.endsWith("ssr_bridge.js")) {
          return null;
        }

        const s = new MagicString(code);

        // Use AST parsing to find actual import statements (not in comments)
        const root = sgParse(Lang.JavaScript, code);

        // Find all import statements using AST patterns
        const importPatterns = [
          'import { $$$ } from "$MODULE"',
          "import { $$$ } from '$MODULE'",
          'import $DEFAULT from "$MODULE"',
          "import $DEFAULT from '$MODULE'",
          'import * as $NS from "$MODULE"',
          "import * as $NS from '$MODULE'",
          'import "$MODULE"',
          "import '$MODULE'",
        ];

        let lastImportEnd = -1;
        for (const pattern of importPatterns) {
          const matches = root.root().findAll(pattern);
          for (const match of matches) {
            const range = match.range();
            if (range.end.index > lastImportEnd) {
              lastImportEnd = range.end.index;
            }
          }
        }

        // Find the export statement using AST
        const exportPatterns = [
          "export { $$$ }",
          'export { $$$ } from "$MODULE"',
          "export { $$$ } from '$MODULE'",
        ];

        let exportStart = -1;
        let exportEnd = -1;
        for (const pattern of exportPatterns) {
          const matches = root.root().findAll(pattern);
          for (const match of matches) {
            const range = match.range();
            // Check if this export contains our target symbols
            const text = match.text();
            if (
              text.includes("renderHtmlStream") &&
              text.includes("ssrLoadModule") &&
              text.includes("ssrWebpackRequire")
            ) {
              exportStart = range.start.index;
              exportEnd = range.end.index;
              break;
            }
          }
          if (exportStart !== -1) break;
        }

        const banner = `export const { renderHtmlStream, ssrLoadModule, ssrWebpackRequire, ssrGetModuleExport, createThenableFromReadableStream } = (function() {`;
        const footer = `return { renderHtmlStream, ssrLoadModule, ssrWebpackRequire, ssrGetModuleExport, createThenableFromReadableStream };\n})();`;

        // Insert banner after the last import (or at the beginning if no imports)
        const insertIndex = lastImportEnd === -1 ? 0 : lastImportEnd;
        s.appendLeft(insertIndex, banner + "\n");

        // Append footer at the end
        s.append(footer);

        // Remove the original export statement if found
        if (exportStart !== -1 && exportEnd !== -1) {
          s.remove(exportStart, exportEnd);
        }

        return {
          code: s.toString(),
          map: s.generateMap(),
        };
      } catch (e) {
        console.error("Error in ssrBridgeWrapPlugin:", e);
        throw e;
      }
    },
  };
};
