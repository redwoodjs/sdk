import { type Plugin } from "vite";
import { Project, Node, SyntaxKind } from "ts-morph";

export const transformClientEntryPlugin = ({
  clientEntryPathname,
  mode,
}: {
  clientEntryPathname: string;
  mode: "development" | "production";
}): Plugin => ({
  name: "rwsdk:transform-client-entry",
  apply: "serve",
  async transform(code: string, id: string) {
    if (id !== clientEntryPathname) {
      return;
    }

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("temp.tsx", code);

    // Collect all transformed imports
    const transformedImports: string[] = [];

    // Add Vite preamble import in development mode
    if (mode === "development") {
      transformedImports.push(
        `await import(/* @vite-ignore */ 'virtual:vite-preamble');`,
      );
    }

    // Transform all imports
    sourceFile.getImportDeclarations().forEach((importDecl) => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      // Handle named imports
      const namedImports = importDecl.getNamedImports();
      if (namedImports.length > 0) {
        const importSpecifiers = namedImports
          .map((named) => {
            const name = named.getName();
            const alias = named.getAliasNode()?.getText();
            return alias ? `${name}: ${alias}` : name;
          })
          .join(", ");

        transformedImports.push(
          `const { ${importSpecifiers} } = await import('${moduleSpecifier}');`,
        );
      }

      // Handle default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        transformedImports.push(
          `const ${defaultImport.getText()} = (await import('${moduleSpecifier}')).default;`,
        );
      }

      // Handle namespace import
      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport) {
        transformedImports.push(
          `const ${namespaceImport.getText()} = await import('${moduleSpecifier}');`,
        );
      }
    });

    // Collect all non-import statements
    const otherStatements = sourceFile
      .getStatements()
      .filter((stmt) => !Node.isImportDeclaration(stmt))
      .map((stmt) => stmt.getText());

    // Create the transformed code
    const transformedCode = `(async () => {
${transformedImports.join("\n")}
${otherStatements.join("\n")}
})();`;

    // Create a new source file with the transformed code
    const transformedFile = project.createSourceFile(
      "transformed.tsx",
      transformedCode,
      { overwrite: true },
    );

    return {
      code: transformedFile.getFullText(),
      map: transformedFile
        .getEmitOutput()
        .getOutputFiles()
        .find((f) => f.getFilePath().endsWith(".js.map"))
        ?.getText(),
    };
  },
});
