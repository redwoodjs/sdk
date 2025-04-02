import { relative } from "node:path";
import { Plugin } from "vite";
import {
  Project,
  Node,
  SyntaxKind,
  FunctionDeclaration,
  ArrowFunction,
  SourceFile,
} from "ts-morph";

interface TransformResult {
  code: string;
  map?: any;
}

interface ComponentInfo {
  node: Node;
  statement?: Node;
  ssrName: string;
  originalName: string;
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
  relativeId: string,
  isWorkerEnvironment: boolean,
): Promise<TransformResult | undefined> {
  if (!isWorkerEnvironment) {
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

  // First pass: collect all information
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
          node,
          ssrName,
          originalName: name,
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
          SyntaxKind.ArrowFunction,
        );
        if (!arrowFunc) return;

        // Only track if it's a component (has JSX return)
        if (isJsxFunction(arrowFunc.getText())) {
          const name = varDecl.getName();
          const isDefault = !!statement.getFirstAncestorByKind(
            SyntaxKind.ExportAssignment,
          );
          const isInlineExport = statement.hasModifier(
            SyntaxKind.ExportKeyword,
          );

          if (
            !name &&
            (isDefault || statement.getText().includes("export default"))
          ) {
            // Handle anonymous default export
            const anonName = `DefaultComponent${anonymousDefaultCount++}`;
            components.set(anonName, {
              node: varDecl,
              statement,
              ssrName: anonName,
              originalName: anonName,
              isDefault: true,
              isInlineExport: true,
              isAnonymousDefault: true,
            });
          } else if (name) {
            components.set(name, {
              node: varDecl,
              statement,
              ssrName: `${name}SSR`,
              originalName: name,
              isDefault,
              isInlineExport,
            });
          }
        }
      });
    });

  // Second pass: rename all identifiers to SSR versions
  components.forEach(({ node, ssrName, isAnonymousDefault }) => {
    if (!isAnonymousDefault) {
      if (Node.isFunctionDeclaration(node)) {
        node.rename(ssrName);
      } else if (Node.isVariableDeclaration(node)) {
        node.getFirstChildByKind(SyntaxKind.Identifier)?.rename(ssrName);
      }
    }
  });

  // Third pass: handle exports
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
  components.forEach(({ node, statement, isInlineExport }) => {
    if (Node.isFunctionDeclaration(node) && isInlineExport) {
      const nodeText = node.getText();
      const newText = nodeText.replace(
        /^export\s+(default\s+)?(async\s+)?function/,
        "$2function",
      );
      node.replaceWithText(newText);
    } else if (
      Node.isVariableDeclaration(node) &&
      statement &&
      isInlineExport
    ) {
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
        (exp) => !components.has(exp.getName()),
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
          `const ${anonName} = registerClientReference("${relativeId}", "default", ${ssrName});`,
        );

        // Remove the original export default node
        node.remove();

        // Store info for later export
        components.set(anonName, {
          node: expression,
          ssrName,
          originalName: anonName,
          isDefault: true,
          isInlineExport: true,
          isAnonymousDefault: true,
        });
      }
    });

  // Add all declarations first
  components.forEach(
    ({ ssrName, originalName, isDefault, isAnonymousDefault }) => {
      if (!isAnonymousDefault) {
        sourceFile.addStatements(
          `const ${originalName} = registerClientReference("${relativeId}", "${isDefault ? "default" : originalName}", ${ssrName});`,
        );
      }
    },
  );

  // Then add all exports after declarations
  components.forEach(({ ssrName, originalName, isDefault }) => {
    if (isDefault) {
      // Export the registerClientReference version as default
      sourceFile.addStatements(
        `export { ${originalName} as default, ${ssrName} };`,
      );
    } else {
      sourceFile.addStatements(`export { ${ssrName}, ${originalName} };`);
    }
  });

  // Add this where we handle other export removals
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
  name: "rw-sdk-use-client",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    if (code.includes('"use client"') || code.includes("'use client'")) {
      const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;
      return transformUseClientCode(
        code,
        relativeId,
        this.environment.name === "worker",
      );
    }
  },
});
