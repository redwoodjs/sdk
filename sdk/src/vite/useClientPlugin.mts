import { relative } from "node:path";
import { Plugin } from "vite";
import { Project, SyntaxKind, Node } from "ts-morph";
import MagicString from "magic-string";

interface TransformResult {
  code: string;
  map?: any;
}

interface TransformEnv {
  environmentName: string;
  topLevelRoot?: string;
}

export async function transformClientComponents(
  code: string,
  id: string,
  env: TransformEnv,
): Promise<TransformResult | undefined> {
  // 1. Skip if not in worker environment
  if (env.environmentName !== "worker") {
    return;
  }
  // 2. Skip node_modules and vite deps
  if (id.includes(".vite/deps") || id.includes("node_modules")) {
    return;
  }
  // 3. Only transform files that start with 'use client'
  const cleanCode = code.trimStart();
  const hasUseClient =
    cleanCode.startsWith('"use client"') ||
    cleanCode.startsWith("'use client'");
  if (!hasUseClient) {
    return { code, map: undefined };
  }

  // Use ts-morph to collect all export info in source order
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      sourceMap: true,
      target: 2, // ES6
      module: 1, // CommonJS
      jsx: 2, // React
    },
  });
  const sourceFile = project.createSourceFile("temp.tsx", code);

  // We'll collect named and default exports in order
  type ExportInfo = {
    local: string;
    exported: string;
    isDefault: boolean;
    statementIdx: number;
  };
  const exportInfos: ExportInfo[] = [];
  let defaultExportInfo: ExportInfo | undefined;

  // Helper to add export info
  function addExport(
    local: string,
    exported: string,
    isDefault: boolean,
    statementIdx: number,
  ) {
    if (isDefault) {
      defaultExportInfo = { local, exported, isDefault, statementIdx };
    } else {
      exportInfos.push({ local, exported, isDefault, statementIdx });
    }
  }

  // Walk through statements in order
  const statements = sourceFile.getStatements();
  statements.forEach((stmt, idx) => {
    // export default function ...
    if (
      Node.isFunctionDeclaration(stmt) &&
      stmt.hasModifier(SyntaxKind.ExportKeyword) &&
      stmt.hasModifier(SyntaxKind.DefaultKeyword)
    ) {
      addExport("default", "default", true, idx);
      return;
    }
    // export default ... (assignment)
    if (Node.isExportAssignment(stmt)) {
      const expr = stmt.getExpression();
      if (Node.isIdentifier(expr)) {
        addExport(expr.getText(), "default", true, idx);
      } else {
        addExport("default", "default", true, idx);
      }
      return;
    }
    // export const foo = ...
    if (
      Node.isVariableStatement(stmt) &&
      stmt.hasModifier(SyntaxKind.ExportKeyword)
    ) {
      stmt
        .getDeclarationList()
        .getDeclarations()
        .forEach((decl) => {
          const name = decl.getName();
          addExport(name, name, false, idx);
        });
      return;
    }
    // export function foo() ...
    if (
      Node.isFunctionDeclaration(stmt) &&
      stmt.hasModifier(SyntaxKind.ExportKeyword)
    ) {
      if (!stmt.hasModifier(SyntaxKind.DefaultKeyword)) {
        const name = stmt.getName();
        if (name) {
          addExport(name, name, false, idx);
        }
      }
      return;
    }
    // export { ... } or export { ... } from ...
    if (Node.isExportDeclaration(stmt)) {
      const namedExports = stmt.getNamedExports();
      if (namedExports.length > 0) {
        namedExports.forEach((exp) => {
          const local = exp.getAliasNode()
            ? exp.getNameNode().getText()
            : exp.getName();
          const exported = exp.getAliasNode()
            ? exp.getAliasNode()!.getText()
            : exp.getName();
          addExport(local, exported, exported === "default", idx);
        });
      }
      return;
    }
  });

  // 4. SSR files: just remove the directive
  if (id.startsWith("virtual:rwsdk:ssr")) {
    const s = new MagicString(code);
    const directiveMatch = code.match(/^(\s*)(["'])use client\2/);
    if (directiveMatch) {
      const fullDirective = directiveMatch[0];
      const directivePos = code.indexOf(fullDirective);
      const directiveEnd = directivePos + fullDirective.length;
      // If followed by a semicolon, include it in the removal
      if (code[directiveEnd] === ";") {
        s.remove(directivePos, directiveEnd + 1);
      } else {
        s.remove(directivePos, directiveEnd);
      }
    }
    return {
      code: s.toString(),
      map: s.generateMap({ hires: true }),
    };
  }

  // 5. Non-SSR files: replace all implementation with registerClientReference logic
  // Remove all original imports for non-SSR 'use client' files
  // Only add the registerClientReference import
  const importLine = 'import { registerClientReference } from "rwsdk/worker";';
  let resultLines: string[] = [];
  resultLines.push(importLine);

  // Add registerClientReference assignments for named exports in order
  for (const info of exportInfos) {
    resultLines.push(
      `const ${info.local} = registerClientReference("${id}", "${info.exported}");`,
    );
  }

  // Add grouped export statement for named exports (preserving order and alias)
  if (exportInfos.length > 0) {
    const exportNames = exportInfos.map((e) =>
      e.local === e.exported ? e.local : `${e.local} as ${e.exported}`,
    );
    resultLines.push(`export { ${exportNames.join(", ")} };`);
  }

  // Add default export if present
  if (defaultExportInfo) {
    resultLines.push(
      `export default registerClientReference("${id}", "${defaultExportInfo.exported}");`,
    );
  }

  // Join all lines with a blank line between each statement, and end with a single trailing newline
  const finalResult = resultLines.join("\n");
  return {
    code: finalResult + "\n",
    map: undefined,
  };
}

export const useClientPlugin = (): Plugin => ({
  name: "rwsdk:use-client",
  async transform(code, id) {
    return transformClientComponents(code, id, {
      environmentName: this.environment?.name ?? "worker",
      topLevelRoot: this.environment?.getTopLevelConfig?.().root,
    });
  },
  configEnvironment(env, config) {
    // Only add for worker environment
    if (env !== "worker") return;
    config.optimizeDeps ??= {};
    config.optimizeDeps.esbuildOptions ??= {};
    config.optimizeDeps.esbuildOptions.plugins ??= [];
    // Avoid duplicate registration
    if (
      !config.optimizeDeps.esbuildOptions.plugins.some(
        (p) => p?.name === "use-client-esbuild-plugin",
      )
    ) {
      config.optimizeDeps.esbuildOptions.plugins.push(useClientEsbuildPlugin());
    }
  },
});

/**
 * Returns an esbuild plugin that applies the same 'use client' transformation as Vite.
 * Register this in your configEnvironment hook (e.g. in optimizeDeps.esbuildOptions.plugins).
 */
export function useClientEsbuildPlugin() {
  return {
    name: "use-client-esbuild-plugin",
    setup(build: any) {
      build.onLoad(
        { filter: /\\.(js|jsx|ts|tsx|mjs|mts)$/ },
        async (args: any) => {
          const fs = await import("fs/promises");
          let code: string;
          try {
            code = await fs.readFile(args.path, "utf-8");
          } catch (err) {
            // Optionally log error here
            return undefined;
          }
          const result = await transformClientComponents(code, args.path, {
            environmentName: "worker",
          });
          if (result && result.code !== code) {
            return {
              contents: result.code,
              loader: args.path.endsWith("x") ? "tsx" : "ts",
            };
          }
          return undefined;
        },
      );
    },
  };
}
