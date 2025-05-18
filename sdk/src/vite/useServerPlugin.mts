import { relative } from "node:path";
import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import MagicString from "magic-string";
import { Project, SyntaxKind, Node } from "ts-morph";

export const transformServerFunctions = (code: string) => {
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

  return sourceFile.getFullText();
};

export const useServerPlugin = (): Plugin => ({
  name: "rwsdk:use-server",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;

    if (code.indexOf("use server") === -1) {
      return;
    }

    code = transformServerFunctions(code);

    // context(justinvdm, 5 Dec 2024): they've served their purpose at this point, keeping them around just causes rollup warnings since module level directives can't easily be applied to bundled
    // modules
    let s = new MagicString(code);

    if (this.environment.name === "worker") {
      // TODO: Rewrite the code, but register the "function" against
      s.prepend(`
import { registerServerReference } from "rwsdk/worker";
`);
      const [_, exports] = parse(code);

      for (const e of exports) {
        s.append(`
registerServerReference(${e.ln}, ${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
`);
      }
    }
    if (this.environment.name === "client") {
      s = new MagicString(`\
import { createServerReference } from "rwsdk/client";
`);
      const [_, exports] = parse(code);
      for (const e of exports) {
        s.append(`\
export const ${e.ln} = createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)})
`);
      }
    }

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
    // }
  },
});
