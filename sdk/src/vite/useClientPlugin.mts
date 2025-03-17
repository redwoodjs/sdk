import { relative } from "node:path";
import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import MagicString from "magic-string";

interface UseClientPluginOptions {}

export const useClientPlugin = (
  options: UseClientPluginOptions = {},
): Plugin => ({
  name: "rw-sdk-use-client",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const s = new MagicString(code);
    const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;

    if (code.includes('"use client"') || code.includes("'use client'")) {
      // context(justinvdm, 5 Dec 2024): they've served their purpose at this point, keeping them around just causes rollup warnings since module level directives can't easily be applied to bundled
      // modules
      s.replaceAll("'use client'", "");
      s.replaceAll('"use client"', "");
      s.trim();

      if (this.environment.name === "worker") {
        s.prepend(`
import { registerClientReference } from "redwoodsdk/worker";
`);

        const [_, exports] = parse(code);
        const functionExports = new Set();
        const inlineExportedFunctions = new Set();

        // First, collect all function exports
        for (const e of exports) {
          if (e.ln != null) {
            // Check if it's a function declaration
            const isFunctionDeclaration = new RegExp(
              `(export\\s+)?(function\\s+${e.ln}\\b|const\\s+${e.ln}\\s*=\\s*\\(.*\\)\\s*=>|const\\s+${e.ln}\\s*=\\s*function\\s*\\()`,
            ).test(code);

            if (isFunctionDeclaration) {
              functionExports.add(e.ln);

              // Check if it's an inline export
              const isInlineExport = new RegExp(
                `export\\s+(const|function)\\s+${e.ln}\\b`,
              ).test(code);
              if (isInlineExport) {
                inlineExportedFunctions.add(e.ln);
              }
            }
          }
        }

        // Now process the code to find and transform each function
        for (const name of functionExports) {
          // Find function declarations and transform them
          const functionRegex = new RegExp(
            `(export\\s+)?(function\\s+)(${name})\\b([\\s\\S]*?{[\\s\\S]*?})`,
            "g",
          );
          let match;

          while ((match = functionRegex.exec(code)) !== null) {
            const fullMatch = match[0];
            const hasExport = !!match[1];
            const functionBody = match[4];
            const startPos = match.index;
            const endPos = startPos + fullMatch.length;

            // Replace with SSR version only
            s.overwrite(
              startPos,
              endPos,
              `${match[2]}${name}SSR${functionBody}`,
            );
          }

          // Find arrow functions and transform them
          const arrowRegex = new RegExp(
            `(export\\s+)?(const\\s+)(${name})(\\s*=.*?=>.*?[;\\n])`,
            "g",
          );

          while ((match = arrowRegex.exec(code)) !== null) {
            const fullMatch = match[0];
            const hasExport = !!match[1];
            const arrowBody = match[4];
            const startPos = match.index;
            const endPos = startPos + fullMatch.length;

            // Replace with SSR version only
            s.overwrite(startPos, endPos, `${match[2]}${name}SSR${arrowBody}`);
          }
        }

        // Add client references for all functions before exports
        if (functionExports.size > 0) {
          s.append("\n\n// Client references\n");
          for (const name of functionExports) {
            s.append(
              `const ${name} = registerClientReference(${JSON.stringify(relativeId)}, ${JSON.stringify(name)}, ${name}SSR);\n`,
            );
          }
        }

        // Add a grouped export at the end for SSR versions
        const ssrExportNames = Array.from(functionExports).map(
          (name) => `${name}SSR`,
        );

        if (ssrExportNames.length > 0) {
          s.append(`\nexport { ${ssrExportNames.join(", ")} };\n`);
        }

        if (inlineExportedFunctions.size > 0) {
          s.append(
            `\nexport { ${Array.from(inlineExportedFunctions).join(", ")} };\n`,
          );
        }
      }

      return {
        code: s.toString(),
        map: s.generateMap(),
      };
    }
  },
});
