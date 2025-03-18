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
      // context(justinvdm, 5 Dec 2024): they've served their purpose at this point, keeping them around just causes rollup warnings since module level directives can't easily be applied to bundled modules
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

        for (const e of exports) {
          if (e.ln != null) {
            const functionDeclarationPattern = new RegExp(
              `(export\\s+)?(async\\s+)?(function\\s+${e.ln}\\b|const\\s+${e.ln}\\s*=\\s*(?:async\\s+)?(?:\\(.*?\\)\\s*=>|function\\s*\\())`,
              "ms",
            );

            const isFunctionDeclaration = functionDeclarationPattern.test(code);
            console.log("Is function declaration:", isFunctionDeclaration);

            if (isFunctionDeclaration) {
              functionExports.add(e.ln);
              console.log("Added to function exports:", e.ln);

              const isInlineExport = new RegExp(
                `export\\s+(?:async\\s+)?(?:const|function)\\s+${e.ln}\\b`,
                "ms",
              ).test(code);
              if (isInlineExport) {
                inlineExportedFunctions.add(e.ln);
                console.log("Added to inline exports:", e.ln);
              }
            }
          }
        }

        for (const name of functionExports) {
          console.log("Processing function:", name);

          const functionRegex = new RegExp(
            `(export\\s+)?(async\\s+)?(function\\s+)(${name})\\b([\\s\\S]*?{[\\s\\S]*?})`,
            "g",
          );

          const arrowRegex = new RegExp(
            `(export\\s+)?(const\\s+)(${name})(\\s*=\\s*(?:async\\s+)?(?:\\(.*?\\)\\s*=>|function\\s*\\().*?[;\\n])`,
            "gs",
          );

          let match;
          while ((match = functionRegex.exec(code)) !== null) {
            console.log("Found function declaration match:", match[0]);
            const fullMatch = match[0];
            const startPos = match.index;
            const endPos = startPos + fullMatch.length;

            s.overwrite(startPos, endPos, `${match[3]}${name}SSR${match[5]}`);
          }

          while ((match = arrowRegex.exec(code)) !== null) {
            console.log("Found arrow function match:", match[0]);
            const fullMatch = match[0];
            const startPos = match.index;
            const endPos = startPos + fullMatch.length;

            s.overwrite(startPos, endPos, `${match[2]}${name}SSR${match[4]}`);
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
