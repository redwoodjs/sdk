import { relative } from "node:path";
import { Plugin } from "vite";
import { Project, Node, SyntaxKind } from "ts-morph";

interface TransformResult {
  code: string;
  map?: any;
}

interface ComponentInfo {
  name: string;
  ssrName: string;
  isDefault: boolean;
  isInlineExport: boolean;
  isAnonymousDefault?: boolean;
}

function isJsxFunction(text: string): boolean {
  return (
    text.includes("jsx(") || text.includes("jsxs(") || text.includes("jsxDEV(")
  );
}

export async function transformUseClientCode(
  code: string,
  relativeId: string
): Promise<TransformResult | undefined> {
  const cleanCode = code.trimStart();

  if (
    !cleanCode.startsWith('"use client"') &&
    !cleanCode.startsWith("'use client'")
  ) {
    return;
  }

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

  // Add import declaration properly through the AST
  sourceFile.addImportDeclaration({
    moduleSpecifier: "@redwoodjs/sdk/worker",
    namedImports: [{ name: "registerClientReference" }],
  });

  const components = new Map<string, ComponentInfo>();
  let anonymousDefaultCount = 0;

  // Pass 1: Collect all component information
  // Handle function declarations
  sourceFile
    .getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    .forEach((node) => {
      const name =
        node.getName() || `DefaultComponent${anonymousDefaultCount++}`;
      if (!name) return;

      // Only track if it's a component (has JSX return)
      if (isJsxFunction(node.getText())) {
        const ssrName = `${name}SSR`;
        const isInlineExport = node.hasModifier(SyntaxKind.ExportKeyword);

        // Check if this function is used in a default export
        const isDefault =
          node.hasModifier(SyntaxKind.DefaultKeyword) ||
          sourceFile
            .getDescendantsOfKind(SyntaxKind.ExportAssignment)
            .some((exp) => exp.getExpression().getText() === name);

        components.set(name, {
          name,
          ssrName,
          isDefault,
          isInlineExport,
        });
      }
    });

  // Handle arrow functions and anonymous default exports
  sourceFile
    .getDescendantsOfKind(SyntaxKind.VariableStatement)
    .forEach((statement) => {
      const declarations = statement.getDeclarationList().getDeclarations();
      declarations.forEach((varDecl) => {
        const arrowFunc = varDecl.getFirstDescendantByKind(
          SyntaxKind.ArrowFunction
        );
        if (!arrowFunc) return;

        // Only track if it's a component (has JSX return)
        if (isJsxFunction(arrowFunc.getText())) {
          const name = varDecl.getName();
          const isDefault = !!statement.getFirstAncestorByKind(
            SyntaxKind.ExportAssignment
          );
          const isInlineExport = statement.hasModifier(
            SyntaxKind.ExportKeyword
          );

          if (
            !name &&
            (isDefault || statement.getText().includes("export default"))
          ) {
            // Handle anonymous default export
            const anonName = `DefaultComponent${anonymousDefaultCount++}`;
            components.set(anonName, {
              name: anonName,
              ssrName: anonName,
              isDefault: true,
              isInlineExport: true,
              isAnonymousDefault: true,
            });
          } else if (name) {
            components.set(name, {
              name,
              ssrName: `${name}SSR`,
              isDefault,
              isInlineExport,
            });
          }
        }
      });
    });

  // Pass 2: handle exports
  // Remove use client directives
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((node) => {
    if (
      node.getText() === "'use client'" ||
      node.getText() === '"use client"'
    ) {
      node.getFirstAncestorByKind(SyntaxKind.ExpressionStatement)?.remove();
    }
  });

  // Remove inline exports for components
  // Get fresh node references before modifying
  sourceFile
    .getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    .forEach((node) => {
      const name = node.getName();
      if (!name || !components.has(name)) return;

      const component = components.get(name)!;
      if (component.isInlineExport) {
        const nodeText = node.getText();
        const newText = nodeText.replace(
          /^export\s+(default\s+)?(async\s+)?function/,
          "$2function"
        );
        node.replaceWithText(newText);
      }
    });

  // Handle variable declarations with inline exports
  sourceFile
    .getDescendantsOfKind(SyntaxKind.VariableStatement)
    .forEach((statement) => {
      if (!statement.hasModifier(SyntaxKind.ExportKeyword)) return;

      const declarations = statement.getDeclarationList().getDeclarations();
      let hasComponent = false;

      declarations.forEach((varDecl) => {
        const name = varDecl.getName();
        if (name && components.has(name)) {
          hasComponent = true;
        }
      });

      if (hasComponent) {
        const stmtText = statement.getText();
        const newText = stmtText.replace(/^export\s+/, "");
        statement.replaceWithText(newText);
      }
    });

  // Handle grouped exports - only remove component exports
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportDeclaration)
    .forEach((node) => {
      const namedExports = node.getNamedExports();
      const nonComponentExports = namedExports.filter(
        (exp) => !components.has(exp.getName())
      );

      if (nonComponentExports.length === 0) {
        // If all exports were components, remove the declaration
        node.remove();
      } else if (nonComponentExports.length !== namedExports.length) {
        // If some exports were components, update the export declaration
        const newExports = nonComponentExports
          .map((exp) => exp.getText())
          .join(", ");
        node.replaceWithText(`export { ${newExports} };`);
      }
    });

  // Pass 3: handle default exports with arrow functions
  // First remove the default export node (we'll add it back later)
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      const expression = node.getExpression();

      if (Node.isArrowFunction(expression)) {
        const anonName = `DefaultComponent${anonymousDefaultCount++}`;
        const ssrName = `${anonName}SSR`;

        // First add declarations
        sourceFile.addStatements(`const ${ssrName} = ${expression.getText()}`);
        sourceFile.addStatements(
          `const ${anonName} = registerClientReference("${relativeId}", "default", ${ssrName});`
        );

        // Remove the original export default node
        node.remove();

        // Store info for later export
        components.set(anonName, {
          name: anonName,
          ssrName,
          isDefault: true,
          isInlineExport: true,
          isAnonymousDefault: true,
        });
      }
    });

  // Pass 4: rename all identifiers to SSR version
  // Get fresh node references for each component
  components.forEach(({ name, ssrName, isAnonymousDefault }) => {
    if (isAnonymousDefault) return;

    // Find function declarations by name
    const funcDecls = sourceFile.getDescendantsOfKind(
      SyntaxKind.FunctionDeclaration
    );
    const funcNode = funcDecls.find((decl) => decl.getName() === name);
    if (funcNode) {
      funcNode.rename(ssrName);
      return;
    }

    // Find variable declarations by name
    const varDecls = sourceFile.getDescendantsOfKind(
      SyntaxKind.VariableDeclaration
    );
    const varNode = varDecls.find((decl) => decl.getName() === name);
    if (varNode) {
      varNode.getFirstChildByKind(SyntaxKind.Identifier)?.rename(ssrName);
    }
  });

  // Pass 5: Add client reference registrations
  // Add all declarations first
  components.forEach(({ name, ssrName, isDefault, isAnonymousDefault }) => {
    if (!isAnonymousDefault) {
      sourceFile.addStatements(
        `const ${name} = registerClientReference("${relativeId}", "${
          isDefault ? "default" : name
        }", ${ssrName});`
      );
    }
  });

  // Pass 6: add new exports
  // Then add all exports after declarations
  components.forEach(({ name, ssrName, isDefault }) => {
    if (isDefault) {
      // Export the registerClientReference version as default
      sourceFile.addStatements(`export { ${name} as default, ${ssrName} };`);
    } else {
      sourceFile.addStatements(`export { ${ssrName}, ${name} };`);
    }
  });

  // Clean up any remaining export assignments
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      // If it's not an arrow function (which we handle separately),
      // just remove the export assignment
      node.remove();
    });

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
}

export const useClientPlugin = (): Plugin => ({
  name: "rwsdk:use-client",
  async transform(code, id) {
    if (
      id.includes(".vite/deps") ||
      id.includes("node_modules") ||
      this.environment.name !== "worker"
    ) {
      return;
    }

    const relativeId = `/${relative(
      this.environment.getTopLevelConfig().root,
      id
    )}`;

    return transformUseClientCode(code, relativeId);
  },
});
