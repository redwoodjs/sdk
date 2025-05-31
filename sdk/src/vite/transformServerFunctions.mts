import { Project, SyntaxKind, Node, SourceFile } from "ts-morph";
import debug from "debug";

const log = debug("rwsdk:vite:transform-server-functions");
const verboseLog = debug("verbose:rwsdk:vite:transform-server-functions");

interface TransformResult {
  code: string;
  map?: any;
}

export const findExportedFunctions = (sourceFile: SourceFile) => {
  verboseLog("Finding exported functions in source file");

  const exportedFunctions = new Set<string>();

  const exportAssignments = sourceFile.getDescendantsOfKind(
    SyntaxKind.ExportAssignment,
  );
  for (const e of exportAssignments) {
    const name = e.getExpression().getText();
    if (name === "default") {
      continue;
    }
    exportedFunctions.add(name);
    verboseLog("Found export assignment: %s", name);
  }

  const functionDeclarations = sourceFile.getDescendantsOfKind(
    SyntaxKind.FunctionDeclaration,
  );
  for (const func of functionDeclarations) {
    if (func.hasModifier(SyntaxKind.ExportKeyword)) {
      const name = func.getName();
      if (name) {
        exportedFunctions.add(name);
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
            exportedFunctions.add(name);
            verboseLog("Found exported arrow function: %s", name);
          }
        }
      }
    }
  }

  log(
    "Found %d exported functions: %O",
    exportedFunctions.size,
    Array.from(exportedFunctions),
  );
  return exportedFunctions;
};

export const transformServerFunctions = (
  code: string,
  normalizedId: string,
  environment: "client" | "worker" | "ssr",
): TransformResult | undefined => {
  verboseLog(
    "Transform server functions called for normalizedId=%s, environment=%s",
    normalizedId,
    environment,
  );

  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      sourceMap: true,
      target: 2,
      module: 1,
      jsx: 2,
    },
  });
  const sourceFile = project.createSourceFile("temp.tsx", code);

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

  if (environment === "ssr") {
    log("Transforming for SSR environment: normalizedId=%s", normalizedId);
    const ssrSourceFile = project.createSourceFile("ssr.tsx", "");

    ssrSourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/__ssr",
      namedImports: ["createServerReference"],
    });

    const exports = findExportedFunctions(sourceFile);
    for (const name of exports) {
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

    const exports = findExportedFunctions(sourceFile);
    for (const name of exports) {
      if (name === "__defaultServerFunction__") continue;
      sourceFile.addStatements(
        `registerServerReference(${name}, ${JSON.stringify(normalizedId)}, ${JSON.stringify(name)})`,
      );
      log(
        "Registered worker server reference for function: %s in normalizedId=%s",
        name,
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

    const exports = findExportedFunctions(sourceFile);
    for (const name of exports) {
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
