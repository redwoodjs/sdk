import { Project, Node, SyntaxKind, ImportDeclaration } from "ts-morph";
import { type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";
import path from "node:path";
import debug from "debug";

const log = debug("rwsdk:vite:transform-jsx-script-tags");

let manifestCache: Record<string, { file: string }> | undefined;

const readManifest = async (
  manifestPath: string,
): Promise<Record<string, { file: string }>> => {
  if (manifestCache === undefined) {
    const exists = await pathExists(manifestPath);

    if (!exists) {
      throw new Error(
        `RedwoodSDK expected client manifest to exist at ${manifestPath}. This is likely a bug. Please report it at https://github.com/redwoodjs/sdk/issues/new`,
      );
    }

    manifestCache = JSON.parse(await readFile(manifestPath, "utf-8"));
  }

  return manifestCache!;
};

function hasJsxFunctions(text: string): boolean {
  return (
    text.includes('jsx("script"') ||
    text.includes("jsx('script'") ||
    text.includes('jsx("link"') ||
    text.includes("jsx('link'") ||
    text.includes('jsxs("script"') ||
    text.includes("jsxs('script'") ||
    text.includes('jsxs("link"') ||
    text.includes("jsxs('link'") ||
    text.includes('jsxDEV("script"') ||
    text.includes("jsxDEV('script'") ||
    text.includes('jsxDEV("link"') ||
    text.includes("jsxDEV('link'")
  );
}

// Transform import statements in script content using ts-morph
function transformScriptImports(
  scriptContent: string,
  manifest: Record<string, any>,
): {
  content: string | undefined;
  hasChanges: boolean;
  entryPoints: string[];
} {
  const scriptProject = new Project({ useInMemoryFileSystem: true });

  try {
    // Wrap in a function to make it valid JavaScript
    const wrappedContent = `function __wrapper() {${scriptContent}}`;
    const scriptFile = scriptProject.createSourceFile(
      "script.js",
      wrappedContent,
    );

    let hasChanges = false;
    const entryPoints: string[] = [];

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
              log(
                "Found dynamic import with root-relative path: %s",
                importPath,
              );
              entryPoints.push(importPath);

              const path = importPath.slice(1); // Remove leading slash

              if (manifest[path]) {
                const transformedSrc = `/${manifest[path].file}`;
                args[0].setLiteralValue(transformedSrc);
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

      return { content: transformedContent, hasChanges: true, entryPoints };
    }

    // Return the original content when no changes are made
    return { content: scriptContent, hasChanges: false, entryPoints };
  } catch (error) {
    // If parsing fails, fall back to the original content
    console.warn("Failed to parse inline script content:", error);
    return { content: undefined, hasChanges: false, entryPoints: [] };
  }
}

export async function transformJsxScriptTagsCode(
  code: string,
  manifest: Record<string, any> = {},
) {
  // context(justinvdm, 15 Jun 2025): Optimization to exit early
  // to avoidunnecessary ts-morph parsing
  if (!hasJsxFunctions(code)) {
    return;
  }

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.tsx", code);

  let hasModifications = false;
  const needsRequestInfoImportRef = { value: false };

  // Check for existing imports up front
  let hasRequestInfoImport = false;
  let sdkWorkerImportDecl: ImportDeclaration | undefined;

  // Scan for imports only once
  sourceFile.getImportDeclarations().forEach((importDecl) => {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    if (moduleSpecifier === "rwsdk/worker") {
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
      const entryPoints: string[] = [];

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

                  if (srcValue.startsWith("/")) {
                    entryPoints.push(srcValue);

                    const path = srcValue.slice(1); // Remove leading slash
                    if (manifest[path]) {
                      const transformedSrc = `/${manifest[path].file}`;
                      initializer.setLiteralValue(transformedSrc);
                      hasModifications = true;
                    }
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
                const {
                  content: transformedContent,
                  hasChanges: contentHasChanges,
                  entryPoints: dynamicEntryPoints,
                } = transformScriptImports(scriptContent, manifest);

                entryPoints.push(...dynamicEntryPoints);

                if (contentHasChanges && transformedContent) {
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
              needsRequestInfoImportRef.value = true;
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
      if (entryPoints.length > 0) {
        log(
          "Found %d script entry points, adding to scripts to be loaded: %o",
          entryPoints.length,
          entryPoints,
        );
        const sideEffects = entryPoints
          .map((p) => `(requestInfo.rw.scriptsToBeLoaded.add("${p}"))`)
          .join(",\n");

        const leadingCommentRanges = callExpr.getLeadingCommentRanges();
        const pureComment = leadingCommentRanges.find((r) =>
          r.getText().includes("@__PURE__"),
        );
        const callExprText = callExpr.getText();

        if (pureComment) {
          const pureCommentText = pureComment.getText();
          const newText = `(
            ${sideEffects},
            ${pureCommentText} ${callExprText}
          )`;

          const fullText = callExpr.getFullText();
          const leadingTriviaText = fullText.substring(
            0,
            fullText.length - callExprText.length,
          );
          const newLeadingTriviaText = leadingTriviaText.replace(
            pureCommentText,
            "",
          );

          // By replacing from `getFullStart`, we remove the original node and all its leading trivia
          // and replace it with our manually reconstructed string.
          // This should correctly move the pure comment and preserve other comments and whitespace.
          callExpr
            .getSourceFile()
            .replaceText(
              [callExpr.getFullStart(), callExpr.getEnd()],
              newLeadingTriviaText + newText,
            );
        } else {
          callExpr.replaceWithText(
            `(
              ${sideEffects},
              ${callExprText}
            )`,
          );
        }
        needsRequestInfoImportRef.value = true;
        hasModifications = true;
      }
    });

  // Add requestInfo import if needed and not already imported
  if (needsRequestInfoImportRef.value && hasModifications) {
    if (sdkWorkerImportDecl) {
      // Module is imported but need to add requestInfo
      if (!hasRequestInfoImport) {
        sdkWorkerImportDecl.addNamedImport("requestInfo");
      }
    } else {
      // Add new import declaration
      sourceFile.addImportDeclaration({
        moduleSpecifier: "rwsdk/worker",
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
    name: "rwsdk:vite:transform-jsx-script-tags",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    async transform(code, id) {
      if (
        this.environment?.name === "worker" &&
        id.endsWith(".tsx") &&
        !id.includes("node_modules") &&
        hasJsxFunctions(code)
      ) {
        const manifest = isBuild ? await readManifest(manifestPath) : {};
        const result = await transformJsxScriptTagsCode(code, manifest);
        if (result) {
          log("Transformed JSX script tags in %s", id);
          process.env.VERBOSE &&
            log("New Document code for %s:\n%s", id, result.code);
          return {
            code: result.code,
            map: null,
          };
        }
      }
      return null;
    },
  };
};
