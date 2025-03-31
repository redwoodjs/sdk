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
import MagicString from "magic-string";

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

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.tsx", code);
  const magicString = new MagicString(code);
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
      const stmt = node.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
      if (stmt) {
        const start = stmt.getStart();
        const end = stmt.getEnd();
        magicString.remove(start, end);
      }
    }
  });

  // Remove inline exports for components
  components.forEach(({ node, statement, isInlineExport, isDefault }) => {
    if (Node.isFunctionDeclaration(node)) {
      const functionKeyword = node.getFirstChildByKind(
        SyntaxKind.FunctionKeyword,
      );
      if (functionKeyword) {
        const start = node.getStart();
        const firstNonModifier = functionKeyword.getStart();

        // Remove everything from start of node to start of 'function' keyword
        if (firstNonModifier > start) {
          magicString.remove(start, firstNonModifier);
        }
      }
    } else if (Node.isVariableDeclaration(node) && statement) {
      const declarationList = statement.getFirstChildByKind(
        SyntaxKind.VariableDeclarationList,
      );
      if (declarationList) {
        const start = statement.getStart();
        const firstNonModifier = declarationList.getStart();

        // Remove everything from start of statement to start of declaration list
        if (firstNonModifier > start) {
          magicString.remove(start, firstNonModifier);
        }
      }
    }
  });

  // Handle separate default exports
  sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportAssignment)
    .forEach((node) => {
      const expression = node.getExpression();
      if (
        Node.isIdentifier(expression) &&
        components.has(expression.getText())
      ) {
        magicString.remove(node.getStart(), node.getEnd());
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

  // Add import at the top
  magicString.prepend(
    'import { registerClientReference } from "@redwoodjs/sdk/worker";\n\n',
  );

  // Add client references and exports
  components.forEach(
    ({ ssrName, originalName, isDefault, isAnonymousDefault }) => {
      if (isAnonymousDefault) {
        // For anonymous default exports, leave as-is
        return;
      }

      magicString.append(
        `\nconst ${originalName} = registerClientReference("${relativeId}", "${isDefault ? "default" : originalName}", ${ssrName});`,
      );

      if (isDefault) {
        magicString.append(`\nexport default ${ssrName};`);
      } else {
        magicString.append(`\nexport { ${ssrName}, ${originalName} };`);
      }
    },
  );

  return {
    code: magicString.toString(),
    map: magicString.generateMap({
      source: relativeId,
      includeContent: true,
      hires: true,
    }),
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
