import debug from "debug";
import MagicString from "magic-string";
import type { Plugin } from "vite";

const log = debug("rwsdk:vite:ssr-bridge-wrap");

export const ssrBridgeWrapPlugin = (): Plugin => {
  return {
    name: "rwsdk:ssr-bridge-wrap",
    apply: "build",
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith("ssr_bridge.js")) {
        return null;
      }

      log("Wrapping SSR bridge chunk: %s", chunk.fileName);

      const s = new MagicString(code);

      // We need to find the last import statement so we can start the IIFE
      // *after* all imports.
      //
      // We can rely on the fact that in an ES module (which this bundle is),
      // imports are static and hoisted to the top. However, they might be
      // interspersed with comments or newlines.
      //
      // A robust heuristic for a generated bundle is to find the last line
      // starting with "import ".
      const lines = code.split("\n");
      let lastImportLineIndex = -1;
      // Keep track of the actual character index for the insertion point
      let insertCharIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("import ") || line.startsWith("import{")) {
          lastImportLineIndex = i;
        }
      }

      // Calculate character index for insertion (start of the line after the last import)
      // If no imports, we insert at the very beginning (index 0)
      if (lastImportLineIndex !== -1) {
        // Sum lengths of lines up to lastImportLineIndex + 1
        let charCount = 0;
        for (let i = 0; i <= lastImportLineIndex; i++) {
          charCount += lines[i].length + 1; // +1 for newline
        }
        insertCharIndex = charCount;
      }

      const banner = `export const { renderHtmlStream, ssrLoadModule, ssrWebpackRequire, ssrGetModuleExport, createThenableFromReadableStream } = (function() {`;
      const footer = `return { renderHtmlStream, ssrLoadModule, ssrWebpackRequire, ssrGetModuleExport, createThenableFromReadableStream };\n})();`;

      // Insert banner
      s.appendLeft(insertCharIndex, banner + "\n");

      // Append footer
      s.append(footer);

      // Also, we need to remove the original export statement for these symbols,
      // as we are now re-exporting them from the IIFE result.
      // We look for a standard export statement block. Since we are wrapping
      // the whole file (minus imports), this should be the only export statement
      // we care about. The regex matches `export` followed by whitespace/newlines,
      // `{`, any content until `}`, and optional semicolon.
      const exportRegex = /export\s*\{[\s\S]*?\}\s*;?/;
      const match = exportRegex.exec(code);

      if (match) {
        log("Removing original export statement at index %d", match.index);
        s.remove(match.index, match.index + match[0].length);
      } else {
        log(
          "WARNING: Failed to find export statement to remove from SSR bridge chunk",
        );
      }

      return {
        code: s.toString(),
        map: s.generateMap(),
      };
    },
  };
};
