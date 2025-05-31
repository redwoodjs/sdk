import { Project, SyntaxKind, Node } from "ts-morph";
import debug from "debug";

interface TransformContext {
  environmentName: string;
  clientFiles?: Set<string>;
  isEsbuild?: boolean;
}

interface TransformResult {
  code: string;
  map?: any;
}

const logVite = debug("rwsdk:vite:transform-client-components:vite");
const logEsbuild = debug("rwsdk:vite:transform-client-components:esbuild");
const verboseLogVite = debug(
  "verbose:rwsdk:vite:transform-client-components:vite",
);
const verboseLogEsbuild = debug(
  "verbose:rwsdk:vite:transform-client-components:esbuild",
);

export async function transformClientComponents(
  code: string,
  normalizedId: string,
  ctx: TransformContext,
): Promise<TransformResult | undefined> {
  const log = ctx.isEsbuild ? logEsbuild : logVite;
  const verboseLog = ctx.isEsbuild ? verboseLogEsbuild : verboseLogVite;
  log(
    "Called transformClientComponents for id: id=%s, ctx: %O",
    normalizedId,
    ctx,
  );

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
    log("Skipping: no 'use client' directive in id=%s", normalizedId);
    verboseLog(
      ":VERBOSE: Returning code unchanged for id=%s:\n%s",
      normalizedId,
      code,
    );
    return;
  }
  log("Processing 'use client' module: id=%s", normalizedId);

  ctx.clientFiles?.add(normalizedId);

  // Use ts-morph to collect all export info and perform transformations
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

  // Walk through statements in order to collect export information
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
    log(
      ":isEsbuild=%s: Handling SSR virtual module: %s",
      !!ctx.isEsbuild,
      normalizedId,
    );

    // Remove 'use client' directive using ts-morph
    sourceFile
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .forEach((node) => {
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

    const emitOutput = sourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    verboseLog(
      ":VERBOSE: SSR transformed code for %s:\n%s",
      normalizedId,
      sourceFile.getFullText(),
    );

    return {
      code: sourceFile.getFullText(),
      map: sourceMap,
    };
  }

  // 4. Non-SSR files: replace all implementation with registerClientReference logic
  // Clear the source file and rebuild it
  sourceFile.removeText();

  // Add import declaration
  sourceFile.addImportDeclaration({
    moduleSpecifier: "rwsdk/worker",
    namedImports: [{ name: "registerClientReference" }],
  });

  // Add registerClientReference assignments for named exports in order
  for (const info of exportInfos) {
    log(
      ":isEsbuild=%s: Registering client reference for named export: %s as %s",
      !!ctx.isEsbuild,
      info.local,
      info.exported,
    );
    sourceFile.addStatements(
      `const ${info.local} = registerClientReference("${normalizedId}", "${info.exported}");`,
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
    sourceFile.addStatements(`export { ${exportNames.join(", ")} };`);
  }

  // Add default export if present
  if (defaultExportInfo) {
    log(
      ":isEsbuild=%s: Registering client reference for default export: %s",
      !!ctx.isEsbuild,
      defaultExportInfo.exported,
    );
    sourceFile.addStatements(
      `export default registerClientReference("${normalizedId}", "${defaultExportInfo.exported}");`,
    );
  }

  const emitOutput = sourceFile.getEmitOutput();
  let sourceMap: any;

  for (const outputFile of emitOutput.getOutputFiles()) {
    if (outputFile.getFilePath().endsWith(".js.map")) {
      sourceMap = JSON.parse(outputFile.getText());
    }
  }

  const finalResult = sourceFile.getFullText();

  log(
    ":isEsbuild=%s: Final transformed code for %s:\n%s",
    !!ctx.isEsbuild,
    normalizedId,
    finalResult,
  );

  verboseLog(
    ":VERBOSE: Transformed code for %s (normalizedId=%s):\n%s",
    normalizedId,
    finalResult,
  );

  return {
    code: finalResult,
    map: sourceMap,
  };
}

export type { TransformContext, TransformResult };
