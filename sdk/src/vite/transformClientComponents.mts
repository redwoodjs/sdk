import { Project, SyntaxKind, Node } from "ts-morph";
import MagicString from "magic-string";
import debug from "debug";
import { ensureSSRNamespace } from "./virtualizedSSRPlugin.mjs";

interface TransformResult {
  code: string;
  map?: any;
}

interface TransformEnv {
  environmentName: string;
  topLevelRoot?: string;
  isEsbuild?: boolean;
}

const logVite = debug("rwsdk:transform-client-components:vite");
const logEsbuild = debug("rwsdk:transform-client-components:esbuild");

export async function transformClientComponents(
  code: string,
  id: string,
  env: TransformEnv,
): Promise<TransformResult | undefined> {
  const log = env.isEsbuild ? logEsbuild : logVite;
  log("Called transformClientComponents for id: id=%s, env: %O", id, env);
  // 1. Skip if not in worker environment
  if (env.environmentName !== "worker") {
    log("Skipping: not in worker environment (%s)", env.environmentName);
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
  if (id.startsWith("virtual:rwsdk:ssr")) {
    log(":isEsbuild=%s: Handling SSR virtual module: %s", !!env.isEsbuild, id);
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
    const transformed = {
      code: s.toString(),
      map: s.generateMap({ hires: true }),
    };
    if (process.env.VERBOSE) {
      log(":VERBOSE: SSR transformed code for %s:\n%s", id, transformed.code);
    }
    return transformed;
  }

  // 4. Non-SSR files: replace all implementation with registerClientReference logic
  // Remove all original imports for non-SSR 'use client' files
  // Only add the registerClientReference import
  const ssrModuleId = ensureSSRNamespace(id);

  const importLine = 'import { registerClientReference } from "rwsdk/worker";';
  const ssrModuleImportLine = `import "${ssrModuleId}";`;
  let resultLines: string[] = [];
  resultLines.push(importLine);
  resultLines.push(ssrModuleImportLine);

  // Add registerClientReference assignments for named exports in order
  for (const info of exportInfos) {
    log(
      ":isEsbuild=%s: Registering client reference for named export: %s as %s",
      !!env.isEsbuild,
      info.local,
      info.exported,
    );
    resultLines.push(
      `const ${info.local} = registerClientReference("${ssrModuleId}", "${info.exported}");`,
    );
  }

  // Add grouped export statement for named exports (preserving order and alias)
  if (exportInfos.length > 0) {
    const exportNames = exportInfos.map((e) =>
      e.local === e.exported ? e.local : `${e.local} as ${e.exported}`,
    );
    log(
      ":isEsbuild=%s: Exporting named exports: %O",
      !!env.isEsbuild,
      exportNames,
    );
    resultLines.push(`export { ${exportNames.join(", ")} };`);
  }

  // Add default export if present
  if (defaultExportInfo) {
    log(
      ":isEsbuild=%s: Registering client reference for default export: %s",
      !!env.isEsbuild,
      defaultExportInfo.exported,
    );
    resultLines.push(
      `export default registerClientReference("${id}", "${defaultExportInfo.exported}");`,
    );
  }

  // Join all lines with a blank line between each statement, and end with a single trailing newline
  const finalResult = resultLines.join("\n");
  log(
    ":isEsbuild=%s: Final transformed code for %s:\n%s",
    !!env.isEsbuild,
    id,
    finalResult,
  );
  if (process.env.VERBOSE) {
    log(":VERBOSE: Transformed code for %s:\n%s", id, finalResult + "\n");
  }
  return {
    code: finalResult + "\n",
    map: undefined,
  };
}

export type { TransformResult, TransformEnv };
