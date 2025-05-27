import { Project, SyntaxKind, Node } from "ts-morph";
import MagicString from "magic-string";
import debug from "debug";

interface TransformContext {
  environmentName: string;
  clientFiles?: Set<string>;
  isEsbuild?: boolean;
}

const logVite = debug("rwsdk:transform-client-components:vite");
const logEsbuild = debug("rwsdk:transform-client-components:esbuild");

export async function transformClientComponents(
  code: string,
  id: string,
  ctx: TransformContext,
): Promise<MagicString | undefined> {
  const log = ctx.isEsbuild ? logEsbuild : logVite;
  log("Called transformClientComponents for id: id=%s, ctx: %O", id, ctx);
  // 1. Skip if not in worker environment
  if (ctx.environmentName !== "worker" && ctx.environmentName !== "ssr") {
    log("Skipping: not in worker environment (%s)", ctx.environmentName);
    return;
  }
  // 2. Only transform files that start with 'use client'
  const cleanCode = code.trimStart();
  const hasUseClient =
    cleanCode.startsWith('"use client"') ||
    cleanCode.startsWith("'use client'");
  if (!hasUseClient) {
    log("Skipping: no 'use client' directive in id=%s", id);
    if (process.env.VERBOSE) {
      log(":VERBOSE: Returning code unchanged for id=%s:\n%s", id, code);
    }
    return;
  }
  log("Processing 'use client' module: id=%s", id);

  ctx.clientFiles?.add(id);

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

  // 3. SSR files: just remove the directive
  if (ctx.environmentName === "ssr") {
    log(":isEsbuild=%s: Handling SSR virtual module: %s", !!ctx.isEsbuild, id);
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
    if (process.env.VERBOSE) {
      log(":VERBOSE: SSR transformed code for %s:\n%s", id, s.toString());
    }
    return s;
  }

  // 4. Non-SSR files: replace all implementation with registerClientReference logic
  const s = new MagicString(code);

  const importLine = 'import { registerClientReference } from "rwsdk/worker";';
  let resultLines: string[] = [];
  resultLines.push(importLine);

  // Add registerClientReference assignments for named exports in order
  for (const info of exportInfos) {
    log(
      ":isEsbuild=%s: Registering client reference for named export: %s as %s",
      !!ctx.isEsbuild,
      info.local,
      info.exported,
    );
    resultLines.push(
      `const ${info.local} = registerClientReference("${id}", "${info.exported}");`,
    );
  }

  // Add grouped export statement for named exports (preserving order and alias)
  if (exportInfos.length > 0) {
    const exportNames = exportInfos.map((e) =>
      e.local === e.exported ? e.local : `${e.local} as ${e.exported}`,
    );
    log(
      ":isEsbuild=%s: Exporting named exports: %O",
      !!ctx.isEsbuild,
      exportNames,
    );
    resultLines.push(`export { ${exportNames.join(", ")} };`);
  }

  // Add default export if present
  if (defaultExportInfo) {
    log(
      ":isEsbuild=%s: Registering client reference for default export: %s",
      !!ctx.isEsbuild,
      defaultExportInfo.exported,
    );
    resultLines.push(
      `export default registerClientReference("${id}", "${defaultExportInfo.exported}");`,
    );
  }

  // Replace the entire file content with the new code
  const finalResult = resultLines.join("\n");
  s.overwrite(0, code.length, finalResult + "\n");

  log(
    ":isEsbuild=%s: Final transformed code for %s:\n%s",
    !!ctx.isEsbuild,
    id,
    finalResult,
  );

  if (process.env.VERBOSE) {
    log(":VERBOSE: Transformed code for %s:\n%s", id, finalResult + "\n");
  }

  return s;
}

export type { TransformContext };
