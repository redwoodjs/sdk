import { relative } from "node:path";
import { Plugin } from "vite";
import {
  Project,
  Node,
  SyntaxKind,
  ArrowFunction,
  ExportSpecifier,
  ExportAssignment,
  Identifier,
  ExportDeclaration,
  FunctionDeclaration,
} from "ts-morph";

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
  relativeId: string,
): Promise<TransformResult | undefined> {
  if (code.indexOf("use client") === -1) {
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
  const firstString = sourceFile.getFirstDescendantByKind(
    SyntaxKind.StringLiteral,
  );
  if (
    firstString?.getText().indexOf("use client") === -1 &&
    firstString?.getStart() !== sourceFile.getStart() // `getStart` does not include the leading comments + whitespace
  ) {
    return;
  }

  // Add import declaration properly through the AST
  sourceFile.addImportDeclaration({
    moduleSpecifier: "rwsdk/worker",
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
      const parentExpr = node.getFirstAncestorByKind(
        SyntaxKind.ExpressionStatement,
      );
      if (parentExpr) {
        parentExpr.remove();
      }
    }
  });

  // Create lists of nodes to modify before making any changes
  const functionsToModify: {
    node: Node;
    nodeText: string;
    component: ComponentInfo;
  }[] = [];
  const variableStatementsToModify: { node: Node; stmtText: string }[] = [];
  const exportDeclarationsToModify: {
    node: ExportDeclaration;
    nonComponentExports: ExportSpecifier[];
  }[] = [];
  const exportAssignmentsToModify: {
    node: ExportAssignment;
    expression: ArrowFunction | null;
  }[] = [];

  // Collect function declarations to modify
  sourceFile
    .getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    .forEach((node) => {
      const name = node.getName();
      if (!name || !components.has(name)) return;

      const component = components.get(name)!;
      if (component.isInlineExport) {
        functionsToModify.push({
          node,
          nodeText: node.getText(),
          component,
        });
      }
    });

  // Collect variable statements to modify
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
        variableStatementsToModify.push({
          node: statement,
          stmtText: statement.getText(),
        });
      }
    });

  // Collect export declarations to modify
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportDeclaration)
    .forEach((node) => {
      const namedExports = node.getNamedExports();
      const nonComponentExports = namedExports.filter(
        (exp) => !components.has(exp.getName()),
      );

      if (nonComponentExports.length !== namedExports.length) {
        exportDeclarationsToModify.push({
          node,
          nonComponentExports,
        });
      }
    });

  // Collect export assignments to modify
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      const expression = node.getExpression();
      if (Node.isArrowFunction(expression)) {
        exportAssignmentsToModify.push({
          node,
          expression,
        });
      } else {
        exportAssignmentsToModify.push({
          node,
          expression: null,
        });
      }
    });

  // Now apply all modifications in sequence to avoid operating on removed nodes

  // Modify function declarations
  functionsToModify.forEach(({ node, nodeText, component }) => {
    const newText = nodeText.replace(
      /^export\s+(default\s+)?(async\s+)?function/,
      "$2function",
    );
    node.replaceWithText(newText);
  });

  // Modify variable statements
  variableStatementsToModify.forEach(({ node, stmtText }) => {
    const newText = stmtText.replace(/^export\s+/, "");
    node.replaceWithText(newText);
  });

  // Modify export declarations
  exportDeclarationsToModify.forEach(({ node, nonComponentExports }) => {
    if (nonComponentExports.length === 0) {
      // If all exports were components, remove the declaration
      node.remove();
    } else {
      // If some exports were components, update the export declaration
      const newExports = nonComponentExports
        .map((exp) => exp.getText())
        .join(", ");
      node.replaceWithText(`export { ${newExports} };`);
    }
  });

  // Handle export assignments with arrow functions
  exportAssignmentsToModify.forEach(({ node, expression }) => {
    if (expression && Node.isArrowFunction(expression)) {
      const anonName = `DefaultComponent${anonymousDefaultCount++}`;
      const ssrName = `${anonName}SSR`;

      // First add declarations
      sourceFile.addStatements(`const ${ssrName} = ${expression.getText()}`);
      sourceFile.addStatements(
        `const ${anonName} = registerClientReference("${relativeId}", "default", ${ssrName});`,
      );

      // Store info for later export
      components.set(anonName, {
        name: anonName,
        ssrName,
        isDefault: true,
        isInlineExport: true,
        isAnonymousDefault: true,
      });
    }

    // Remove the original export default node
    node.remove();
  });

  // Pass 4: rename all identifiers to SSR version - collect first
  const identifiersToRename: {
    node: Identifier | FunctionDeclaration;
    newName: string;
  }[] = [];

  components.forEach(({ name, ssrName, isAnonymousDefault }) => {
    if (isAnonymousDefault) return;

    // Find function declarations by name
    const funcDecls = sourceFile.getDescendantsOfKind(
      SyntaxKind.FunctionDeclaration,
    );
    const funcNode = funcDecls.find((decl) => decl.getName() === name);
    if (funcNode) {
      identifiersToRename.push({ node: funcNode, newName: ssrName });
      return;
    }

    // Find variable declarations by name
    const varDecls = sourceFile.getDescendantsOfKind(
      SyntaxKind.VariableDeclaration,
    );
    const varNode = varDecls.find((decl) => decl.getName() === name);
    if (varNode) {
      const identifier = varNode.getFirstChildByKind(SyntaxKind.Identifier);
      if (identifier) {
        identifiersToRename.push({ node: identifier, newName: ssrName });
      }
    }
  });

  // Now apply the renames
  identifiersToRename.forEach(({ node, newName }) => {
    node.rename(newName);
  });

  // Pass 5: Add client reference registrations
  // Add all declarations first
  components.forEach(({ name, ssrName, isDefault, isAnonymousDefault }) => {
    if (!isAnonymousDefault) {
      sourceFile.addStatements(
        `const ${name} = registerClientReference("${relativeId}", "${
          isDefault ? "default" : name
        }", ${ssrName});`,
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
      id,
    )}`;

    return transformUseClientCode(code, relativeId);
  },
});
