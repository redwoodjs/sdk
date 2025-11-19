import debug from "debug";
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

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("import ") || line.startsWith("import{")) {
          lastImportLineIndex = i;
        }
      }

      // We want to insert the opening line after the last import.
      // If no imports, we insert at the very beginning (index 0).
      const insertIndex = lastImportLineIndex + 1;

      const banner = `export const { renderHtmlStream, ssrLoadModule, ssrWebpackRequire, ssrGetModuleExport, createThenableFromReadableStream } = (function() {`;
      const footer = `return { renderHtmlStream, ssrLoadModule, ssrWebpackRequire, ssrGetModuleExport, createThenableFromReadableStream };\n})();`;

      // Insert banner
      lines.splice(insertIndex, 0, banner);

      // Append footer
      lines.push(footer);

      // Also, we need to remove the original export statement for these symbols,
      // as we are now re-exporting them from the IIFE result.
      // We look for a standard export statement block. Since we are wrapping
      // the whole file (minus imports), this should be the only export statement
      // we care about. The regex matches `export` followed by whitespace/newlines,
      // `{`, any content until `}`, and optional semicolon.
      const newCode = lines
        .join("\n")
        .replace(/export\s*\{[\s\S]*?\}\s*;?/, "");

      if (newCode.includes("export {")) {
        log("WARNING: Failed to remove export statement from SSR bridge chunk");
      }

      return {
        code: newCode,
        map: null, // We should probably generate a map here ideally, but for now null (magic-string would be better)
      };
    },
  };
};
