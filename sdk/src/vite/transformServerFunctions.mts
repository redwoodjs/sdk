import { Project, SyntaxKind, Node, SourceFile } from "ts-morph";

interface TransformResult {
  code: string;
  map?: any;
}

export const findExportedFunctions = (sourceFile: SourceFile) => {
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
  }

  const functionDeclarations = sourceFile.getDescendantsOfKind(
    SyntaxKind.FunctionDeclaration,
  );
  for (const func of functionDeclarations) {
    if (func.hasModifier(SyntaxKind.ExportKeyword)) {
      const name = func.getName();
      if (name) exportedFunctions.add(name);
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
          }
        }
      }
    }
  }

  return exportedFunctions;
};

export const transformServerFunctions = (
  code: string,
  relativeId: string,
  environment: "client" | "worker" | "ssr",
): TransformResult | undefined => {
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

  const firstString = sourceFile.getFirstDescendantByKind(
    SyntaxKind.StringLiteral,
  );
  if (!firstString) {
    return;
  }
  if (
    firstString?.getText().indexOf("use server") === -1 &&
    firstString?.getStart() !== sourceFile.getStart()
  ) {
    return;
  }

  if (firstString) {
    const parent = firstString.getParent();
    if (parent && Node.isExpressionStatement(parent)) {
      parent.replaceWithText("");
    }
  }

  if (environment === "ssr") {
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
            initializer: `createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(name)})`,
          },
        ],
      });
    }

    const hadDefaultExport = !!sourceFile.getDefaultExportSymbol();
    if (hadDefaultExport) {
      ssrSourceFile.addExportAssignment({
        expression: `createServerReference(${JSON.stringify(relativeId)}, "default")`,
        isExportEquals: false,
      });
    }

    const emitOutput = ssrSourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    return {
      code: ssrSourceFile.getFullText(),
      map: sourceMap,
    };
  } else if (environment === "worker") {
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
        `registerServerReference(__defaultServerFunction__, ${JSON.stringify(relativeId)}, "default")`,
      );
    }

    const exports = findExportedFunctions(sourceFile);
    for (const name of exports) {
      if (name === "__defaultServerFunction__") continue;
      sourceFile.addStatements(
        `registerServerReference(${name}, ${JSON.stringify(relativeId)}, ${JSON.stringify(name)})`,
      );
    }

    const emitOutput = sourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    return {
      code: sourceFile.getFullText(),
      map: sourceMap,
    };
  } else if (environment === "client") {
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
            initializer: `createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(name)})`,
          },
        ],
      });
    }

    const hadDefaultExport = !!sourceFile.getDefaultExportSymbol();
    if (hadDefaultExport) {
      clientSourceFile.addExportAssignment({
        expression: `createServerReference(${JSON.stringify(relativeId)}, "default")`,
        isExportEquals: false,
      });
    }

    const emitOutput = clientSourceFile.getEmitOutput();
    let sourceMap: any;

    for (const outputFile of emitOutput.getOutputFiles()) {
      if (outputFile.getFilePath().endsWith(".js.map")) {
        sourceMap = JSON.parse(outputFile.getText());
      }
    }

    return {
      code: clientSourceFile.getFullText(),
      map: sourceMap,
    };
  }
};

export type { TransformResult };
