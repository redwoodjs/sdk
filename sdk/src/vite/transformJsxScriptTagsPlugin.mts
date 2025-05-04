import { Project, Node, SyntaxKind, ImportDeclaration } from "ts-morph";
import { type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";

// Use a Map to cache manifests by path
const manifestCache = new Map<string, Record<string, { file: string }>>();

const readManifest = async (
  manifestPath: string,
): Promise<Record<string, { file: string }>> => {
  if (!manifestCache.has(manifestPath)) {
    const exists = await pathExists(manifestPath);
    const content = exists
      ? JSON.parse(await readFile(manifestPath, "utf-8"))
      : {};
    manifestCache.set(manifestPath, content);
  }
  return manifestCache.get(manifestPath)!;
};

// Check if a string includes any jsx function calls
function hasJsxFunctions(text: string): boolean {
  return (
    text.includes("jsx(") || text.includes("jsxs(") || text.includes("jsxDEV(")
  );
}

// Transform import statements in script content using ts-morph
function transformScriptImports(
  scriptContent: string,
  manifest: Record<string, any>,
): { content: string | undefined; hasChanges: boolean } {
  const scriptProject = new Project({ useInMemoryFileSystem: true });

  try {
    // Wrap in a function to make it valid JavaScript
    const wrappedContent = `function __wrapper() {${scriptContent}}`;
    const scriptFile = scriptProject.createSourceFile(
      "script.js",
      wrappedContent,
    );

    let hasChanges = false;

    // Find all CallExpressions that look like import("path")
    scriptFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .forEach((callExpr) => {
        const expr = callExpr.getExpression();

        // Check for both "import()" and "await import()" patterns
        const isImport = expr.getText() === "import";

        // Check for await import pattern
        const isAwaitImport =
          expr.getKind() === SyntaxKind.PropertyAccessExpression &&
          expr.getText().endsWith(".import");

        if (isImport || isAwaitImport) {
          const args = callExpr.getArguments();

          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            const importPath = args[0].getLiteralValue();

            if (importPath.startsWith("/")) {
              const path = importPath.slice(1); // Remove leading slash

              if (manifest[path]) {
                const transformedPath = manifest[path].file;
                args[0].replaceWithText(`"/${transformedPath}"`);
                hasChanges = true;
              }
            }
          }
        }
      });

    if (hasChanges) {
      // Extract the transformed content from inside the wrapper function
      const fullText = scriptFile.getFullText();
      // Find content between the first { and the last }
      const startPos = fullText.indexOf("{") + 1;
      const endPos = fullText.lastIndexOf("}");
      const transformedContent = fullText.substring(startPos, endPos);

      return { content: transformedContent, hasChanges: true };
    }

    // Return the original content when no changes are made
    return { content: scriptContent, hasChanges: false };
  } catch (error) {
    // If parsing fails, fall back to the original content
    console.warn("Failed to parse inline script content:", error);
    return { content: undefined, hasChanges: false };
  }
}

export async function transformJsxScriptTagsCode(
  code: string,
  manifest: Record<string, any> = {},
) {
  // Quick heuristic check if there's JSX in the code
  if (!hasJsxFunctions(code)) {
    return;
  }

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.tsx", code);

  let hasModifications = false;
  let needsRequestInfoImport = false;

  // Check for existing imports up front
  let hasRequestInfoImport = false;
  let sdkWorkerImportDecl: ImportDeclaration | undefined;

  // Scan for imports only once
  sourceFile.getImportDeclarations().forEach((importDecl) => {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    if (moduleSpecifier === "@redwoodjs/sdk/worker") {
      sdkWorkerImportDecl = importDecl;
      // Check if requestInfo is already imported
      if (
        importDecl
          .getNamedImports()
          .some((namedImport) => namedImport.getName() === "requestInfo")
      ) {
        hasRequestInfoImport = true;
      }
    }
  });

  // Look for jsx function calls (jsx, jsxs, jsxDEV)
  sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .forEach((callExpr) => {
      const expression = callExpr.getExpression();
      const expressionText = expression.getText();

      // Only process jsx/jsxs/jsxDEV calls
      if (
        expressionText !== "jsx" &&
        expressionText !== "jsxs" &&
        expressionText !== "jsxDEV"
      ) {
        return;
      }

      // Get arguments of the jsx call
      const args = callExpr.getArguments();
      if (args.length < 2) return;

      // First argument should be the element type
      const elementType = args[0];
      if (!Node.isStringLiteral(elementType)) return;

      const tagName = elementType.getLiteralValue();

      // Process script and link tags
      if (tagName === "script" || tagName === "link") {
        // Second argument should be the props object
        const propsArg = args[1];

        // Handle object literals with properties
        if (Node.isObjectLiteralExpression(propsArg)) {
          const properties = propsArg.getProperties();

          // Variables to track script attributes
          let hasDangerouslySetInnerHTML = false;
          let hasNonce = false;
          let hasStringLiteralChildren = false;
          let hasSrc = false;

          // Variables to track link attributes
          let isPreload = false;
          let hrefValue = null;

          for (const prop of properties) {
            if (Node.isPropertyAssignment(prop)) {
              const propName = prop.getName();
              const initializer = prop.getInitializer();

              // Check for existing nonce
              if (propName === "nonce") {
                hasNonce = true;
              }

              // Check for dangerouslySetInnerHTML
              if (propName === "dangerouslySetInnerHTML") {
                hasDangerouslySetInnerHTML = true;
              }

              // Check for src attribute
              if (tagName === "script" && propName === "src") {
                hasSrc = true;

                // Also process src for manifest transformation if needed
                if (
                  Node.isStringLiteral(initializer) ||
                  Node.isNoSubstitutionTemplateLiteral(initializer)
                ) {
                  const srcValue = initializer.getLiteralValue();
                  if (srcValue.startsWith("/") && manifest[srcValue.slice(1)]) {
                    const path = srcValue.slice(1); // Remove leading slash
                    const transformedSrc = manifest[path].file;
                    const originalText = initializer.getText();
                    const isTemplateLiteral =
                      Node.isNoSubstitutionTemplateLiteral(initializer);
                    const quote = isTemplateLiteral
                      ? "`"
                      : originalText.charAt(0);

                    // Preserve the original quote style
                    if (isTemplateLiteral) {
                      initializer.replaceWithText(`\`/${transformedSrc}\``);
                    } else if (quote === '"') {
                      initializer.replaceWithText(`"/${transformedSrc}"`);
                    } else {
                      initializer.replaceWithText(`'/${transformedSrc}'`);
                    }
                    hasModifications = true;
                  }
                }
              }

              // Check for string literal children
              if (
                tagName === "script" &&
                propName === "children" &&
                (Node.isStringLiteral(initializer) ||
                  Node.isNoSubstitutionTemplateLiteral(initializer))
              ) {
                hasStringLiteralChildren = true;

                const scriptContent = initializer.getLiteralValue();

                // Transform import statements in script content using ts-morph
                const { content: transformedContent, hasChanges } =
                  transformScriptImports(scriptContent, manifest);

                if (hasChanges && transformedContent) {
                  // Get the raw text with quotes to determine the exact format
                  const isTemplateLiteral =
                    Node.isNoSubstitutionTemplateLiteral(initializer);

                  if (isTemplateLiteral) {
                    // Simply wrap the transformed content in backticks
                    initializer.replaceWithText("`" + transformedContent + "`");
                  } else {
                    initializer.replaceWithText(
                      JSON.stringify(transformedContent),
                    );
                  }

                  hasModifications = true;
                }
              }

              // For link tags, first check if it's a preload/modulepreload
              if (tagName === "link") {
                if (
                  propName === "rel" &&
                  (Node.isStringLiteral(initializer) ||
                    Node.isNoSubstitutionTemplateLiteral(initializer))
                ) {
                  const relValue = initializer.getLiteralValue();
                  if (relValue === "preload" || relValue === "modulepreload") {
                    isPreload = true;
                  }
                }

                if (
                  propName === "href" &&
                  (Node.isStringLiteral(initializer) ||
                    Node.isNoSubstitutionTemplateLiteral(initializer))
                ) {
                  hrefValue = initializer.getLiteralValue();
                }
              }
            }
          }

          // Add nonce to script tags if needed
          if (
            tagName === "script" &&
            !hasNonce &&
            !hasDangerouslySetInnerHTML &&
            (hasStringLiteralChildren || hasSrc)
          ) {
            // Add nonce property to the props object
            propsArg.addPropertyAssignment({
              name: "nonce",
              initializer: "requestInfo.rw.nonce",
            });

            if (!hasRequestInfoImport) {
              needsRequestInfoImport = true;
            }

            hasModifications = true;
          }

          // Transform href if this is a preload link
          if (
            tagName === "link" &&
            isPreload &&
            hrefValue &&
            hrefValue.startsWith("/") &&
            manifest[hrefValue.slice(1)]
          ) {
            const path = hrefValue.slice(1); // Remove leading slash
            for (const prop of properties) {
              if (
                Node.isPropertyAssignment(prop) &&
                prop.getName() === "href"
              ) {
                const initializer = prop.getInitializer();
                if (
                  Node.isStringLiteral(initializer) ||
                  Node.isNoSubstitutionTemplateLiteral(initializer)
                ) {
                  const transformedHref = manifest[path].file;
                  const originalText = initializer.getText();
                  const isTemplateLiteral =
                    Node.isNoSubstitutionTemplateLiteral(initializer);
                  const quote = isTemplateLiteral
                    ? "`"
                    : originalText.charAt(0);

                  // Preserve the original quote style
                  if (isTemplateLiteral) {
                    initializer.replaceWithText(`\`/${transformedHref}\``);
                  } else if (quote === '"') {
                    initializer.replaceWithText(`"/${transformedHref}"`);
                  } else {
                    initializer.replaceWithText(`'/${transformedHref}'`);
                  }
                  hasModifications = true;
                }
              }
            }
          }
        }
      }
    });

  // Add requestInfo import if needed and not already imported
  if (needsRequestInfoImport && hasModifications) {
    if (sdkWorkerImportDecl) {
      // Module is imported but need to add requestInfo
      if (!hasRequestInfoImport) {
        sdkWorkerImportDecl.addNamedImport("requestInfo");
      }
    } else {
      // Add new import declaration
      sourceFile.addImportDeclaration({
        moduleSpecifier: "@redwoodjs/sdk/worker",
        namedImports: ["requestInfo"],
      });
    }
  }

  // Return the transformed code only if modifications were made
  if (hasModifications) {
    return {
      code: sourceFile.getFullText(),
      map: null,
    };
  }

  return;
}

export const transformJsxScriptTagsPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => {
  let isBuild = false;

  return {
    name: "rwsdk:transform-jsx-script-tags",

    configResolved(config) {
      isBuild = config.command === "build";
    },

    async transform(code, id) {
      let manifest = {};

      if (isBuild) {
        manifest = await readManifest(manifestPath);
      }

      if (id.includes("Document.tsx")) {
        console.log("########", {
          env: this.environment.name,
          manifest,
        });
      }

      return transformJsxScriptTagsCode(code, manifest);
    },
  };
};
