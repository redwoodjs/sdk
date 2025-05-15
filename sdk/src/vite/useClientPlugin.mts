import { relative } from "node:path";
import { Plugin } from "vite";
import {
  Project,
  SyntaxKind,
  Node,
  ExportDeclaration,
  ExportAssignment,
  Identifier,
  FunctionDeclaration,
} from "ts-morph";

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
  // 4. Remove 'use client' directive using ts-morph
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
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((node) => {
    if (
      node.getText() === "'use client'" ||
      node.getText() === '"use client"'
    ) {
      const parentExpr = node.getFirstAncestorByKind(
        SyntaxKind.ExpressionStatement,
      );
      if (parentExpr) {
        parentExpr.remove();
      }
    }
  });
  // 5. If not a virtual SSR file, just remove the directive and return
  if (!id.includes("virtual:rwsdk:ssr")) {
    return {
      code: sourceFile.getFullText(),
      map: undefined,
    };
  }
  // 6. For SSR files, apply the complete transformation
  // (ts-morph export handling logic follows)
  // Add import for registerClientReference if not present
  const hasImport = sourceFile
    .getImportDeclarations()
    .some((imp) => imp.getModuleSpecifierValue() === "rwsdk/worker");
  if (!hasImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/worker",
      namedImports: [{ name: "registerClientReference" }],
    });
  }
  const registrations: string[] = [];
  const exportStatements: string[] = [];
  const handledExports = new Set<string>();
  let hasDefaultExport = false;
  // Handle export default ...
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      hasDefaultExport = true;
      const expr = node.getExpression();
      if (Node.isIdentifier(expr)) {
        // export default Component;
        registrations.push(
          `export default registerClientReference("${id}", "${expr.getText()}");`,
        );
      } else {
        // export default () => ... or export default function ...
        registrations.push(
          `export default registerClientReference("${id}", "default");`,
        );
      }
      node.remove();
    });

  // Handle export declarations (grouped/aliased)
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportDeclaration)
    .forEach((node) => {
      const namedExports = node.getNamedExports();
      if (namedExports.length > 0) {
        const bindings: string[] = [];
        namedExports.forEach((exp) => {
          const local = exp.getAliasNode()
            ? exp.getNameNode().getText()
            : exp.getName();
          const exported = exp.getAliasNode()
            ? exp.getAliasNode()!.getText()
            : exp.getName();
          registrations.push(
            `const ${local} = registerClientReference("${id}", "${exported}");`,
          );
          bindings.push(exp.getText());
          handledExports.add(local);
        });
        exportStatements.push(`export { ${bindings.join(", ")} };`);
        node.remove();
      }
    });

  // Handle named exports (export const foo = ..., export function bar() ..., etc)
  sourceFile.getStatements().forEach((stmt) => {
    if (
      Node.isVariableStatement(stmt) &&
      stmt.hasModifier(SyntaxKind.ExportKeyword)
    ) {
      stmt
        .getDeclarationList()
        .getDeclarations()
        .forEach((decl) => {
          const name = decl.getName();
          if (!handledExports.has(name)) {
            registrations.push(
              `const ${name} = registerClientReference("${id}", "${name}");`,
            );
            exportStatements.push(`export { ${name} };`);
            handledExports.add(name);
          }
        });
      stmt.toggleModifier("export", false);
    }
    if (
      Node.isFunctionDeclaration(stmt) &&
      stmt.hasModifier(SyntaxKind.ExportKeyword)
    ) {
      const name = stmt.getName();
      if (name && !handledExports.has(name)) {
        registrations.push(
          `const ${name} = registerClientReference("${id}", "${name}");`,
        );
        exportStatements.push(`export { ${name} };`);
        handledExports.add(name);
      }
      stmt.toggleModifier("export", false);
    }
  });

  // Compose the final code
  // Insert registrations after the last import declaration, or at the top if none
  const importDecls = sourceFile.getImportDeclarations();
  const insertIndex =
    importDecls.length > 0
      ? importDecls[importDecls.length - 1].getChildIndex() + 1
      : 0;
  sourceFile.insertStatements(insertIndex, registrations.join("\n"));
  // Insert export statements at the end
  sourceFile.addStatements(exportStatements.join("\n"));

  // If there was a default export not handled above, add it
  if (!hasDefaultExport && handledExports.has("default")) {
    sourceFile.addStatements(
      `export default registerClientReference("${id}", "default");`,
    );
  }

  return {
    code: sourceFile.getFullText(),
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
});
