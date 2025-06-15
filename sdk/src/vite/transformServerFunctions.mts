import { Project, SyntaxKind, Node, SourceFile } from "ts-morph";
import debug from "debug";
import { hasDirective } from "./hasDirective.mjs";

const log = debug("rwsdk:vite:transform-server-functions");
const verboseLog = debug("verbose:rwsdk:vite:transform-server-functions");

interface TransformResult {
  code: string;
  map?: any;
}

type ExportInfo = {
  localFunctions: Set<string>;
  reExports: Array<{
    localName: string;
    originalName: string;
    moduleSpecifier: string;
  }>;
};

export const findExportedFunctions = (
  sourceFile: SourceFile,
  normalizedId?: string,
): Set<string> => {
  return findExportInfo(sourceFile, normalizedId).localFunctions;
};

export const findExportInfo = (
  sourceFile: SourceFile,
  normalizedId?: string,
): ExportInfo => {
  verboseLog("Finding exported functions in source file");

  const localFunctions = new Set<string>();
  const reExports: ExportInfo["reExports"] = [];

  const exportAssignments = sourceFile.getDescendantsOfKind(
    SyntaxKind.ExportAssignment,
  );
  for (const e of exportAssignments) {
    const name = e.getExpression().getText();
    if (name === "default") {
      continue;
    }
    localFunctions.add(name);
    verboseLog("Found export assignment: %s", name);
  }

  const functionDeclarations = sourceFile.getDescendantsOfKind(
    SyntaxKind.FunctionDeclaration,
  );
  for (const func of functionDeclarations) {
    if (func.hasModifier(SyntaxKind.ExportKeyword)) {
      const name = func.getName();
      if (name) {
        localFunctions.add(name);
        verboseLog("Found exported function declaration: %s", name);
      }
    }
  }

  const variableStatements = sourceFile.getDescendantsOfKind(
    SyntaxKind.VariableStatement,
  );
  for (const statement of variableStatements) {
    if (statement.hasModifier(SyntaxKind.ExportKeyword)) {
      const declarations = statement.getDeclarationList().getDeclarations();
      for (const declaration of declarations) {
        const initializer = declaration.getInitializer();
        if (initializer && Node.isArrowFunction(initializer)) {
          const name = declaration.getName();
          if (name) {
            localFunctions.add(name);
            verboseLog("Found exported arrow function: %s", name);
          }
        }
      }
    }
  }

  // Handle re-exports
  const exportDeclarations = sourceFile.getDescendantsOfKind(
    SyntaxKind.ExportDeclaration,
  );
  for (const exportDecl of exportDeclarations) {
    const moduleSpecifier = exportDecl.getModuleSpecifier();
    if (!moduleSpecifier) continue; // Skip re-exports without module specifier

    const namedExports = exportDecl.getNamedExports();
    for (const namedExport of namedExports) {
      // Use the alias if present, otherwise use the original name
      const localName =
        namedExport.getAliasNode()?.getText() || namedExport.getName();
      const originalName = namedExport.getName();
      if (localName && originalName) {
        reExports.push({
          localName,
          originalName,
          moduleSpecifier: moduleSpecifier.getLiteralText(),
        });
        verboseLog(
          "Found re-exported function: %s from %s",
          localName,
          moduleSpecifier.getLiteralText(),
        );
      }
    }

    // Check for export * from - log warning and skip
    if (!namedExports.length && !exportDecl.getNamespaceExport()) {
      // This is an export * from statement
      console.warn(
        "Warning: 'export * from' re-exports are not supported in server functions. " +
          "Please use named exports instead (e.g., 'export { functionName } from \"./module\"'). " +
          "File: %s, Ignoring: %s",
        normalizedId,
        exportDecl.getText().trim(),
      );
    }
  }

  log(
    "Found %d local functions: %O",
    localFunctions.size,
    Array.from(localFunctions),
  );
  log(
    "Found %d re-exports: %O",
    reExports.length,
    reExports.map((r) => `${r.localName} from ${r.moduleSpecifier}`),
  );

  return { localFunctions, reExports };
};

export const transformServerFunctions = (
  code: string,
  normalizedId: string,
  environment: "client" | "worker" | "ssr",
  serverFiles?: Set<string>,
  addServerModule?: (environment: string, id: string) => void,
): TransformResult | undefined => {
  verboseLog(
    "Transform server functions called for normalizedId=%s, environment=%s",
    normalizedId,
    environment,
  );

  if (!hasDirective(code, "use server")) {
    log("Skipping: no 'use server' directive in id=%s", normalizedId);
    verboseLog(
      ":VERBOSE: Returning code unchanged for id=%s:\n%s",
      normalizedId,
      code,
    );
    return;
  }

  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      sourceMap: true,
      target: 2,
      module: 1,
      jsx: 2,
    },
  });
  const sourceFile = project.createSourceFile(normalizedId, code);

  const statements = sourceFile.getStatements();
  let hasUseServerDirective = false;

  for (const stmt of statements) {
    if (!Node.isExpressionStatement(stmt)) break;

    const expr = stmt.getExpression();
    if (!expr || !Node.isStringLiteral(expr)) break;

    const value = expr.getLiteralText();
    if (value === "use server") {
      hasUseServerDirective = true;
      log(
        "Found 'use server' directive at top level for normalizedId=%s",
        normalizedId,
      );
      stmt.remove();
      verboseLog(
        "Removed 'use server' directive from normalizedId=%s",
        normalizedId,
      );
      break;
    }
  }

  if (!hasUseServerDirective) {
    verboseLog(
      "No 'use server' directive found at top-level, skipping transformation for normalizedId=%s",
      normalizedId,
    );
    return;
  }

  log(
    "Processing 'use server' module: normalizedId=%s, environment=%s",
    normalizedId,
    environment,
  );

  addServerModule?.(environment, normalizedId);

  if (environment === "ssr") {
    log("Transforming for SSR environment: normalizedId=%s", normalizedId);
    const ssrSourceFile = project.createSourceFile("ssr.tsx", "");

    ssrSourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/__ssr",
      namedImports: ["createServerReference"],
    });

    const exportInfo = findExportInfo(sourceFile, normalizedId);
    const allExports = new Set([
      ...exportInfo.localFunctions,
      ...exportInfo.reExports.map((r) => r.localName),
    ]);
    for (const name of allExports) {
      ssrSourceFile.addVariableStatement({
        isExported: true,
        declarations: [
          {
            name: name,
            initializer: `createServerReference(${JSON.stringify(normalizedId)}, ${JSON.stringify(name)})`,
          },
        ],
      });
      log(
        "Added SSR server reference for function: %s in normalizedId=%s",
        name,
        normalizedId,
      );
    }

    const hadDefaultExport = !!sourceFile.getDefaultExportSymbol();
    if (hadDefaultExport) {
      ssrSourceFile.addExportAssignment({
        expression: `createServerReference(${JSON.stringify(normalizedId)}, "default")`,
        isExportEquals: false,
      });
      log(
        "Added SSR server reference for default export in normalizedId=%s",
        normalizedId,
      );
    }

    const emitOutput = ssrSourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    log("SSR transformation complete for normalizedId=%s", normalizedId);
    return {
      code: ssrSourceFile.getFullText(),
      map: sourceMap,
    };
  } else if (environment === "worker") {
    log("Transforming for worker environment: normalizedId=%s", normalizedId);

    const exportInfo = findExportInfo(sourceFile, normalizedId);

    // Add imports for re-exported functions so they exist in scope
    for (const reExport of exportInfo.reExports) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: reExport.moduleSpecifier,
        namedImports:
          reExport.originalName === "default"
            ? [{ name: "default", alias: reExport.localName }]
            : [
                reExport.originalName === reExport.localName
                  ? reExport.originalName
                  : { name: reExport.originalName, alias: reExport.localName },
              ],
      });
      log(
        "Added import for re-exported function: %s from %s in normalizedId=%s",
        reExport.localName,
        reExport.moduleSpecifier,
        normalizedId,
      );
    }

    sourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/worker",
      namedImports: ["registerServerReference"],
    });

    const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
    const defaultExportDecl = defaultExportSymbol?.getDeclarations()[0];
    let hasDefaultExport = false;
    if (defaultExportDecl && Node.isFunctionDeclaration(defaultExportDecl)) {
      hasDefaultExport = true;
      defaultExportDecl.setIsDefaultExport(false);
      defaultExportDecl.rename("__defaultServerFunction__");
      sourceFile.addExportAssignment({
        expression: "__defaultServerFunction__",
        isExportEquals: false,
      });
      sourceFile.addStatements(
        `registerServerReference(__defaultServerFunction__, ${JSON.stringify(normalizedId)}, "default")`,
      );
      log(
        "Registered worker server reference for default export in normalizedId=%s",
        normalizedId,
      );
    }

    // Register local functions
    for (const name of exportInfo.localFunctions) {
      if (name === "__defaultServerFunction__") continue;
      sourceFile.addStatements(
        `registerServerReference(${name}, ${JSON.stringify(normalizedId)}, ${JSON.stringify(name)})`,
      );
      log(
        "Registered worker server reference for local function: %s in normalizedId=%s",
        name,
        normalizedId,
      );
    }

    // Register re-exported functions
    for (const reExport of exportInfo.reExports) {
      sourceFile.addStatements(
        `registerServerReference(${reExport.localName}, ${JSON.stringify(normalizedId)}, ${JSON.stringify(reExport.localName)})`,
      );
      log(
        "Registered worker server reference for re-exported function: %s in normalizedId=%s",
        reExport.localName,
        normalizedId,
      );
    }

    const emitOutput = sourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    log("Worker transformation complete for normalizedId=%s", normalizedId);
    return {
      code: sourceFile.getFullText(),
      map: sourceMap,
    };
  } else if (environment === "client") {
    log("Transforming for client environment: normalizedId=%s", normalizedId);
    const clientSourceFile = project.createSourceFile("client.tsx", "");

    clientSourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/client",
      namedImports: ["createServerReference"],
    });

    const exportInfo = findExportInfo(sourceFile, normalizedId);
    const allExports = new Set([
      ...exportInfo.localFunctions,
      ...exportInfo.reExports.map((r) => r.localName),
    ]);
    for (const name of allExports) {
      clientSourceFile.addVariableStatement({
        isExported: true,
        declarations: [
          {
            name: name,
            initializer: `createServerReference(${JSON.stringify(normalizedId)}, ${JSON.stringify(name)})`,
          },
        ],
      });
      log(
        "Added client server reference for function: %s in normalizedId=%s",
        name,
        normalizedId,
      );
      verboseLog(
        "Added client server reference for function: %s in normalizedId=%s",
        name,
        normalizedId,
      );
    }

    const hadDefaultExport = !!sourceFile.getDefaultExportSymbol();
    if (hadDefaultExport) {
      clientSourceFile.addExportAssignment({
        expression: `createServerReference(${JSON.stringify(normalizedId)}, "default")`,
        isExportEquals: false,
      });
      log(
        "Added client server reference for default export in normalizedId=%s",
        normalizedId,
      );
    }

    const emitOutput = clientSourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    log("Client transformation complete for normalizedId=%s", normalizedId);
    return {
      code: clientSourceFile.getFullText(),
      map: sourceMap,
    };
  }

  verboseLog(
    "No transformation applied for environment=%s, normalizedId=%s",
    environment,
    normalizedId,
  );
};

export type { TransformResult };
