import { relative } from "node:path";
import { Plugin } from "vite";
import { Project, SyntaxKind, Node, SourceFile } from "ts-morph";

export const findExportedFunctions = (sourceFile: SourceFile) => {
  const exportedFunctions = new Set<string>();

  // Handle export assignments
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

  // Handle named function exports
  const functionDeclarations = sourceFile.getDescendantsOfKind(
    SyntaxKind.FunctionDeclaration,
  );
  for (const func of functionDeclarations) {
    if (func.hasModifier(SyntaxKind.ExportKeyword)) {
      const name = func.getName();
      if (name) exportedFunctions.add(name);
    }
  }

  // Handle exported arrow functions
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
  environment: "client" | "worker",
) => {
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

  const firstString = sourceFile.getFirstDescendantByKind(
    SyntaxKind.StringLiteral,
  );
  if (!firstString) {
    return;
  }
  if (
    firstString?.getText().indexOf("use server") === -1 &&
    firstString?.getStart() !== sourceFile.getStart() // `getStart` does not include the leading comments + whitespace
  ) {
    return;
  }

  // remove the "use server" directive
  if (firstString) {
    const parent = firstString.getParent();
    if (parent && Node.isExpressionStatement(parent)) {
      parent.replaceWithText("");
    }
  }

  const defaultExport = sourceFile
    .getDefaultExportSymbol()
    ?.getDeclarations()[0];
  if (defaultExport && Node.isFunctionDeclaration(defaultExport)) {
    // remove the default export, and instead make it a named export called "defaultServerFunction"
    const name = defaultExport.getName() || "defaultServerFunction";
    // Remove the default export
    defaultExport.setIsDefaultExport(false);
    // Change to a named export
    defaultExport.setIsExported(true);

    // Add a default export that references the named export
    sourceFile.addExportAssignment({
      expression: name,
      isExportEquals: false,
    });
  }

  if (environment === "worker") {
    // import { registerServerReference } from "rwsdk/worker";
    sourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/worker",
      namedImports: ["registerServerReference"],
    });

    // Append the registerServerReference calls for each exported function:
    // registerServerReference("sum", "/test.tsx", "sum");
    const exports = findExportedFunctions(sourceFile);
    for (const name of exports) {
      sourceFile.addStatements(
        `registerServerReference(${name}, ${JSON.stringify(relativeId)}, ${JSON.stringify(name)})`,
      );
    }

    return sourceFile.getFullText();
  } else if (environment === "client") {
    const clientSourceFile = project.createSourceFile("client.tsx", "");

    // import { createServerReference } from "rwsdk/client";
    clientSourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/client",
      namedImports: ["createServerReference"],
    });

    // Export the createServerReference calls for each exported function.
    // export const sum = createServerReference("/test.tsx", "sum");
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

    return clientSourceFile.getFullText();
  }
};

export const useServerPlugin = (): Plugin => ({
  name: "rwsdk:use-server",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    if (code.indexOf("use server") === -1) {
      return;
    }

    return transformServerFunctions(
      code,
      `/${relative(this.environment.getTopLevelConfig().root, id)}`,
      this.environment.name as "client" | "worker",
    );
  },
});
