import { Project, Node, SyntaxKind } from "ts-morph";
import { type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";

const manifestCache = new Map<string, Promise<any>>();

const readManifest = async (manifestPath: string) => {
  if (!manifestCache.has(manifestPath)) {
    manifestCache.set(
      manifestPath,
      (await pathExists(manifestPath))
        ? readFile(manifestPath, "utf-8").then(JSON.parse)
        : Promise.resolve({}),
    );
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
): { content: string; hasChanges: boolean } {
  const scriptProject = new Project({ useInMemoryFileSystem: true });

  try {
    // Wrap in a function to make it valid JavaScript
    const wrappedContent = `function __wrapper() {\n${scriptContent}\n}`;
    const scriptFile = scriptProject.createSourceFile(
      "script.js",
      wrappedContent,
    );

    let hasChanges = false;

    // Find all CallExpressions that look like import("path")
    scriptFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .forEach((callExpr) => {
        if (callExpr.getExpression().getText() === "import") {
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
      const transformedContent = fullText.substring(startPos, endPos).trim();

      return { content: transformedContent, hasChanges: true };
    }

    return { content: scriptContent, hasChanges: false };
  } catch (error) {
    // If parsing fails, fall back to the original content
    console.warn("Failed to parse inline script content:", error);
    return { content: scriptContent, hasChanges: false };
  }
}

export async function transformJsxScriptTagsCode(
  code: string,
  manifest: Record<string, any>,
) {
  // Quick heuristic check if there's JSX in the code
  if (!hasJsxFunctions(code)) {
    return;
  }

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.tsx", code);

  let hasModifications = false;

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

          // Variables to track link attributes
          let isPreload = false;
          let hrefValue = null;

          for (const prop of properties) {
            if (Node.isPropertyAssignment(prop)) {
              const propName = prop.getName();
              const initializer = prop.getInitializer();

              // Handle script src attributes
              if (
                tagName === "script" &&
                propName === "src" &&
                Node.isStringLiteral(initializer)
              ) {
                const srcValue = initializer.getLiteralValue();
                if (srcValue.startsWith("/")) {
                  const path = srcValue.slice(1); // Remove leading slash
                  if (manifest[path]) {
                    const transformedSrc = manifest[path].file;
                    initializer.replaceWithText(`"/${transformedSrc}"`);
                    hasModifications = true;
                  }
                }
              }

              // Handle script children (inline scripts)
              if (
                tagName === "script" &&
                propName === "children" &&
                Node.isStringLiteral(initializer)
              ) {
                const scriptContent = initializer.getLiteralValue();

                // Transform import statements in script content using ts-morph
                const { content: transformedContent, hasChanges } =
                  transformScriptImports(scriptContent, manifest);

                if (hasChanges) {
                  // Always use double quotes with JSON.stringify for consistency
                  initializer.replaceWithText(
                    JSON.stringify(transformedContent),
                  );
                  hasModifications = true;
                }
              }

              // For link tags, first check if it's a preload/modulepreload
              if (tagName === "link") {
                if (propName === "rel" && Node.isStringLiteral(initializer)) {
                  const relValue = initializer.getLiteralValue();
                  if (relValue === "preload" || relValue === "modulepreload") {
                    isPreload = true;
                  }
                }

                if (propName === "href" && Node.isStringLiteral(initializer)) {
                  hrefValue = initializer.getLiteralValue();
                }
              }
            }
          }

          // Transform href if this is a preload link
          if (
            tagName === "link" &&
            isPreload &&
            hrefValue &&
            hrefValue.startsWith("/")
          ) {
            const path = hrefValue.slice(1); // Remove leading slash
            if (manifest[path]) {
              for (const prop of properties) {
                if (
                  Node.isPropertyAssignment(prop) &&
                  prop.getName() === "href"
                ) {
                  const initializer = prop.getInitializer();
                  if (Node.isStringLiteral(initializer)) {
                    const transformedHref = manifest[path].file;
                    initializer.replaceWithText(`"/${transformedHref}"`);
                    hasModifications = true;
                  }
                }
              }
            }
          }
        }
      }
    });

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
}): Plugin => ({
  name: "rwsdk:transform-jsx-script-tags",
  apply: "build",
  async transform(code) {
    const manifest = await readManifest(manifestPath);
    const result = await transformJsxScriptTagsCode(code, manifest);
    return result;
  },
});
