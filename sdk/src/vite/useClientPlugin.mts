import { relative } from "node:path";
import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import MagicString from "magic-string";

export async function transformUseClientCode(
  code: string,
  relativeId: string,
  isWorkerEnvironment: boolean,
) {
  const s = new MagicString(code);
  let anonymousCounter = 0;

  s.replaceAll("'use client'", "");
  s.replaceAll('"use client"', "");
  s.trim();

  if (isWorkerEnvironment) {
    s.prepend(`
import { registerClientReference } from "redwoodsdk/worker";
`);

    const [_, exports] = parse(code);
    const functionExports = new Set();
    const inlineExportedFunctions = new Set();
    const exportAliases = new Map();

    for (const e of exports) {
      if (e.ln != null) {
        const functionDeclarationPattern = new RegExp(
          `(export\\s+)?(async\\s+)?(function\\s+${e.ln}\\b|const\\s+${e.ln}\\s*=\\s*(?:async\\s+)?(?:\\(.*?\\)\\s*=>|function\\s*\\())`,
          "ms",
        );

        const isFunctionDeclaration = functionDeclarationPattern.test(code);

        if (isFunctionDeclaration) {
          const originalName = e.ln;
          const exportName = e.n || e.ln;
          functionExports.add(originalName);
          if (exportName !== originalName) {
            exportAliases.set(originalName, exportName);
          }

          const isInlineExport = new RegExp(
            `export\\s+(?:async\\s+)?(?:const|function)\\s+${e.ln}\\b`,
            "ms",
          ).test(code);
          if (isInlineExport) {
            inlineExportedFunctions.add(e.ln);
          }
        }
      }
    }

    for (const name of functionExports) {
      const functionRegex = new RegExp(
        `(export\\s+default\\s+)?(async\\s+)?(function\\s+)(${name})\\b([\\s\\S]*?{[\\s\\S]*?})`,
        "g",
      );

      const arrowRegex = new RegExp(
        `(export\\s+default\\s+)?(const\\s+)(${name})(\\s*=\\s*(?:async\\s+)?(?:\\(.*?\\)\\s*=>|function\\s*\\().*?[;\\n])`,
        "gs",
      );

      let match;
      while ((match = functionRegex.exec(code)) !== null) {
        const fullMatch = match[0];
        const startPos = match.index;
        const endPos = startPos + fullMatch.length;

        const asyncKeyword = match[2] || "";
        const isDefault = match[1]?.includes("default") || false;
        s.overwrite(
          startPos,
          endPos,
          `${isDefault ? "" : ""}${asyncKeyword}function ${name}SSR${match[5]}`,
        );
      }

      while ((match = arrowRegex.exec(code)) !== null) {
        const fullMatch = match[0];
        const startPos = match.index;
        const endPos = startPos + fullMatch.length;

        const originalDecl = code.slice(startPos, endPos);
        const newDecl = originalDecl
          .replace(/export\s+default\s+/, "export default ")
          .replace(/export\s+/, "")
          .replace(name as string, `${name}SSR`);
        s.overwrite(startPos, endPos, newDecl);
      }
    }

    // Remove original grouped exports and default exports
    const groupedExportRegex = /export\s*{[^}]*}/g;
    const defaultExportRegex =
      /export\s+default\s+(?:async\s+)?(?:(?:\([^)]*\)\s*=>|function(?:\s+\w+)?\s*\([^)]*\))(?:\s*{[^}]*}|\s*=>[^;]*);?)/g;

    // Add a separate pattern for named default function exports
    const namedDefaultExportRegex =
      /export\s+default\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{[^}]*}/g;

    // Update the defaultExportRegex handling for anonymous arrow functions
    const anonymousDefaultExportRegex =
      /export\s+default\s+(async\s+)?(\([^)]*\)\s*=>|\(\)\s*=>)[^;]*/g;

    let match;
    while ((match = groupedExportRegex.exec(code)) !== null) {
      const startPos = match.index;
      const endPos = startPos + match[0].length;
      s.remove(startPos, endPos);
    }

    while ((match = defaultExportRegex.exec(code)) !== null) {
      const startPos = match.index;
      const endPos = startPos + match[0].length;
      s.remove(startPos, endPos);
    }

    // Don't remove named default exports as they're handled by the function transformation
    s.replaceAll(namedDefaultExportRegex, (match, name) => {
      const isAsync = match.includes("async");
      return `${isAsync ? "async " : ""}function ${name}SSR${match.slice(match.indexOf("{"))}`;
    });

    // Update the anonymous default export handling
    s.replaceAll(anonymousDefaultExportRegex, (match, asyncKeyword = "") => {
      const functionName = `AnonymousComponent${anonymousCounter++}`;
      const functionBody = match.slice(match.indexOf("=>") + 2);
      return `${asyncKeyword || ""}function ${functionName}SSR() ${functionBody}

// >>> Client references
const ${functionName} = registerClientReference(${JSON.stringify(relativeId)}, "${functionName}", ${functionName}SSR);

export { ${functionName}SSR };
export { ${functionName} as default };`;
    });

    // Add client references for all functions
    if (functionExports.size > 0) {
      s.append("\n\n// >>> Client references\n");
      for (const originalName of functionExports) {
        const exportName = exportAliases.get(originalName) || originalName;
        s.append(
          `const ${originalName} = registerClientReference(${JSON.stringify(relativeId)}, ${JSON.stringify(exportName)}, ${originalName}SSR);\n`,
        );
      }
    }

    // First export SSR versions
    const ssrExportNames = Array.from(functionExports).map(
      (name) => `${name}SSR`,
    );

    if (ssrExportNames.length > 0) {
      s.append(`\nexport { ${ssrExportNames.join(", ")} };\n`);
    }

    // Then export client versions (only once)
    if (functionExports.size > 0) {
      const defaultExport = Array.from(functionExports).find((name) =>
        new RegExp(
          `export\\s+default\\s+(?:async\\s+)?(?:function\\s+${name}\\b|const\\s+${name}\\s*=)`,
          "ms",
        ).test(code),
      );

      const namedExports = Array.from(functionExports)
        .filter((name) => name !== defaultExport)
        .map((name) => {
          const alias = exportAliases.get(name);
          return alias ? `${name} as ${alias}` : name;
        })
        .join(", ");

      if (namedExports) {
        s.append(`\nexport { ${namedExports} };\n`);
      }

      if (defaultExport) {
        s.append(`export { ${defaultExport} as default };\n`);
      }
    }
  }

  return {
    code: s.toString(),
    map: s.generateMap(),
  };
}

export const useClientPlugin = (): Plugin => ({
  name: "rw-sdk-use-client",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    if (code.includes('"use client"') || code.includes("'use client'")) {
      const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;
      return transformUseClientCode(
        code,
        relativeId,
        this.environment.name === "worker",
      );
    }
  },
});
