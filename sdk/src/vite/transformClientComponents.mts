import { Project, SyntaxKind, Node } from "ts-morph";
import debug from "debug";
import { hasDirective } from "./hasDirective.mjs";
import { invalidateModule } from "./invalidateModule.mjs";
import type { ViteDevServer } from "vite";

interface TransformContext {
  environmentName: string;
  clientFiles?: Set<string>;
  isEsbuild?: boolean;
  addClientModule?: (environment: string, id: string) => void;
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

  if (!hasDirective(code, "use client")) {
    log("Skipping: no 'use client' directive in id=%s", normalizedId);
    verboseLog(
      ":VERBOSE: Returning code unchanged for id=%s:\n%s",
      normalizedId,
      code,
    );
    return;
  }

  log("Processing 'use client' module: id=%s", normalizedId);

  function extractSourceMapFromEmit(sourceFile: any): any {
    const emitOutput = sourceFile.getEmitOutput();
    let sourceMap: any;

    const outputFiles = emitOutput.getOutputFiles();
    log(
      ":isEsbuild=%s: EmitOutput files for %s (%s) - %d files:",
      !!ctx.isEsbuild,
      normalizedId,
      ctx.environmentName,
      outputFiles.length,
    );
    for (const outputFile of outputFiles) {
      log(
        ":isEsbuild=%s: - %s (%s)",
        !!ctx.isEsbuild,
        outputFile.getFilePath(),
        ctx.environmentName,
      );

      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }
    return sourceMap;
  }

  ctx.addClientModule?.(ctx.environmentName, normalizedId);

  // Use ts-morph to collect all export info and perform transformations
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      sourceMap: true,
      inlineSourceMap: false,
      allowJs: true,
      checkJs: true,
      target: 2, // ES6
      module: 1, // CommonJS
      jsx: 2, // React
    },
  });
  const sourceFile = project.createSourceFile(normalizedId + ".ts", code);

  // We'll collect named and default exports in order
  type ExportInfo = {
    local: string;
    exported: string;
    isDefault: boolean;
    statementIdx: number;
    alias?: string;
  };

  const exportInfos: ExportInfo[] = [];
  let defaultExportInfo: ExportInfo | undefined;

  // Helper to get the computed local name (with alias suffix if present)
  function getComputedLocalName(info: ExportInfo): string {
    return `${info.local}${info.alias ? `_${info.alias}` : ""}`;
  }

  // Helper to add export info
  function addExport(
    local: string,
    exported: string,
    isDefault: boolean,
    statementIdx: number,
    alias?: string,
  ) {
    if (isDefault) {
      defaultExportInfo = { local, exported, isDefault, statementIdx };
    } else {
      exportInfos.push({ local, exported, isDefault, statementIdx, alias });
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
          const alias = exp.getAliasNode()?.getText();
          const local = alias ? exp.getNameNode().getText() : exp.getName();
          const exported = alias ? alias : exp.getName();
          addExport(local, exported, exported === "default", idx, alias);
        });
      }
      return;
    }
  });

  // 3. Client/SSR files: just remove the directive
  if (ctx.environmentName === "ssr" || ctx.environmentName === "client") {
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

    const sourceMap = extractSourceMapFromEmit(sourceFile);

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

  // Compute unique computed local names first
  const computedLocalNames = new Map(
    exportInfos.map((info) => [getComputedLocalName(info), info]),
  );

  // Add registerClientReference assignments for unique names
  for (const [computedLocalName, correspondingInfo] of computedLocalNames) {
    log(
      ":isEsbuild=%s: Registering client reference for named export: %s as %s",
      !!ctx.isEsbuild,
      correspondingInfo.local,
      correspondingInfo.exported,
    );
    sourceFile.addStatements(
      `const ${computedLocalName} = registerClientReference("${normalizedId}", "${correspondingInfo.exported}");`,
    );
  }

  // Add grouped export statement for named exports (preserving order and alias)
  if (exportInfos.length > 0) {
    const exportNames = Array.from(computedLocalNames.entries()).map(
      ([computedLocalName, correspondingInfo]) =>
        correspondingInfo.local === correspondingInfo.exported
          ? computedLocalName
          : `${computedLocalName} as ${correspondingInfo.exported}`,
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

  const sourceMap = extractSourceMapFromEmit(sourceFile);

  const finalResult = sourceFile.getFullText();

  verboseLog(
    ":VERBOSE: Transformed code (env=%s, normalizedId=%s):\n%s",
    normalizedId,
    ctx.environmentName,
    finalResult,
  );

  return {
    code: finalResult,
    map: sourceMap,
  };
}

export type { TransformContext, TransformResult };
