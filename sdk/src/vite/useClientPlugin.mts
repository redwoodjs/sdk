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

export async function transformUseClientCode(
  code: string,
  relativeId: string,
  isWorkerEnvironment: boolean,
): Promise<TransformResult> {
  if (!isWorkerEnvironment) {
    return { code };
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
      if (node.getText().includes("jsx(") || node.getText().includes("jsxs(")) {
        const ssrName = `${name}SSR`;
        const isDefault = !!node.getFirstAncestorByKind(
          SyntaxKind.ExportAssignment,
        );
        const isInlineDefault = node.hasModifier(SyntaxKind.DefaultKeyword);
        const isInlineExport = node.hasModifier(SyntaxKind.ExportKeyword);

        components.set(name, {
          node,
          ssrName,
          originalName: name,
          isDefault: isDefault || isInlineDefault,
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
        if (
          arrowFunc.getText().includes("jsx(") ||
          arrowFunc.getText().includes("jsxs(")
        ) {
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
        /^export\s+(async\s+)?function/,
        "$1function",
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

  // Handle default exports - only remove if it's a component
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      const expression = node.getExpression();
      if (
        Node.isIdentifier(expression) &&
        components.has(expression.getText())
      ) {
        node.remove();
      }
    });

  // Add client references and exports
  components.forEach(
    ({ ssrName, originalName, isDefault, isAnonymousDefault }) => {
      if (isAnonymousDefault) {
        // For anonymous default exports, leave as-is
        return;
      }

      sourceFile.addStatements(
        `const ${originalName} = registerClientReference("${relativeId}", "${isDefault ? "default" : originalName}", ${ssrName});`,
      );

      if (isDefault) {
        sourceFile.addStatements(`export default ${ssrName};`);
      } else {
        sourceFile.addStatements(`export { ${ssrName}, ${originalName} };`);
      }
    },
  );

  // When handling export assignments:
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      const expression = node.getExpression();

      if (Node.isArrowFunction(expression)) {
        // For anonymous default export arrow function
        const anonName = `DefaultComponent${anonymousDefaultCount++}`;
        const ssrName = `${anonName}SSR`;

        // Create the SSR component declaration
        sourceFile.addStatements(`const ${ssrName} = ${expression.getText()}`);

        // Register client reference
        sourceFile.addStatements(
          `const ${anonName} = registerClientReference("${relativeId}", "default", ${ssrName});`,
        );

        // Replace original export default with SSR version
        node.replaceWithText(`export default ${ssrName}`);
      }
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
