import { relative } from "node:path";
import { Plugin } from "vite";
import { Project, SyntaxKind, Node } from "ts-morph";

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
    // Add import declaration
    sourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/worker",
      namedImports: ["registerServerReference"],
    });

    // Create a new line for each export
    const exports = sourceFile.getDescendantsOfKind(
      SyntaxKind.ExportAssignment,
    );
    //   registerServerReference(${e.ln}, ${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
    const statements = exports.map((e) => {
      const name = e.getExpression().getText();
      return `registerServerReference(${name}, ${JSON.stringify(relativeId)}, ${JSON.stringify(name)});`;
    });
    sourceFile.insertStatements(sourceFile.getChildCount(), statements);

    return sourceFile.getFullText();
  } else if (environment === "client") {
    // create a new sourcefile for the client
    const clientSourceFile = project.createSourceFile("client.tsx", "");

    // Add import declaration
    clientSourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/client",
      namedImports: ["createServerReference"],
    });

    const exports = sourceFile.getDescendantsOfKind(
      SyntaxKind.ExportAssignment,
    );

    for (const e of exports) {
      // skip the default export.
      if (e.getExpression().getText() === "default") {
        continue;
      }

      const name = e.getExpression().getText();

      // add a new export
      clientSourceFile.addExportAssignment({
        expression: `createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(name)});`,
        isExportEquals: false,
      });

      return clientSourceFile.getFullText();
    }
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

    transformServerFunctions(
      code,
      `/${relative(this.environment.getTopLevelConfig().root, id)}`,
      this.environment.name as "client" | "worker",
    );
  },
});
