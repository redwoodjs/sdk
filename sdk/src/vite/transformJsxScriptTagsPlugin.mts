import {
  Project,
  Node,
  SyntaxKind,
  ImportDeclaration,
  CallExpression,
  CommentRange,
  ObjectLiteralExpression,
} from "ts-morph";
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

// Types for collecting modifications before applying them
interface LiteralValueModification {
  type: "literalValue";
  node: Node;
  value: string;
}

interface ReplaceTextModification {
  type: "replaceText";
  node: Node;
  text: string;
}

interface AddPropertyModification {
  type: "addProperty";
  node: ObjectLiteralExpression;
  name: string;
  initializer: string;
}

interface WrapCallExprModification {
  type: "wrapCallExpr";
  sideEffects: string;
  pureCommentText?: string;
  leadingTriviaText?: string;
  fullStart: number;
  end: number;
  // Store the current state to reconstruct during application
  callExprText: string;
  leadingWhitespace: string;
}

type Modification =
  | LiteralValueModification
  | ReplaceTextModification
  | AddPropertyModification
  | WrapCallExprModification;

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

  const modifications: Modification[] = [];
  const needsRequestInfoImportRef = { value: false };
  const entryPointsPerCallExpr = new Map<
    CallExpression,
    { callExpr: CallExpression; sideEffects: string; pureCommentText?: string }
  >();

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
                      modifications.push({
                        type: "literalValue",
                        node: initializer,
                        value: transformedSrc,
                      });
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

                  const replacementText = isTemplateLiteral
                    ? "`" + transformedContent + "`"
                    : JSON.stringify(transformedContent);

                  modifications.push({
                    type: "replaceText",
                    node: initializer,
                    text: replacementText,
                  });
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
            // Collect nonce property addition
            modifications.push({
              type: "addProperty",
              node: propsArg,
              name: "nonce",
              initializer: "requestInfo.rw.nonce",
            });

            if (!hasRequestInfoImport) {
              needsRequestInfoImportRef.value = true;
            }
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

                  // Preserve the original quote style and prepare replacement text
                  let replacementText: string;
                  if (isTemplateLiteral) {
                    replacementText = `\`/${transformedHref}\``;
                  } else if (quote === '"') {
                    replacementText = `"/${transformedHref}"`;
                  } else {
                    replacementText = `'/${transformedHref}'`;
                  }

                  modifications.push({
                    type: "replaceText",
                    node: initializer,
                    text: replacementText,
                  });
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

        // Store position and static data for later processing
        const wrapInfo = {
          callExpr: callExpr,
          sideEffects: sideEffects,
          pureCommentText: pureComment?.getText(),
        };

        // We'll collect the actual wrap modifications after simple modifications are applied
        if (!entryPointsPerCallExpr.has(callExpr)) {
          entryPointsPerCallExpr.set(callExpr, wrapInfo);
        }

        needsRequestInfoImportRef.value = true;
      }
    });

  // Apply all collected modifications
  if (modifications.length > 0 || entryPointsPerCallExpr.size > 0) {
    // Apply modifications in the right order to avoid invalidating nodes
    // Apply simple modifications first (these are less likely to invalidate other nodes)
    for (const mod of modifications) {
      if (mod.type === "literalValue") {
        (mod.node as any).setLiteralValue(mod.value);
      } else if (mod.type === "replaceText") {
        (mod.node as any).replaceWithText(mod.text);
      } else if (mod.type === "addProperty") {
        mod.node.addPropertyAssignment({
          name: mod.name,
          initializer: mod.initializer,
        });
      }
    }

    // Apply CallExpr wrapping last (these can invalidate other nodes)
    // Now collect the wrap modifications with fresh data after simple modifications
    const wrapModifications: WrapCallExprModification[] = [];

    for (const [callExpr, wrapInfo] of entryPointsPerCallExpr) {
      const fullStart = callExpr.getFullStart();
      const end = callExpr.getEnd();
      const callExprText = callExpr.getText();
      const fullText = callExpr.getFullText();

      // Extract leading whitespace/newlines before the call expression
      const leadingWhitespace = fullText.substring(
        0,
        fullText.length - callExprText.length,
      );

      let pureCommentText: string | undefined;
      let leadingTriviaText: string | undefined;

      if (wrapInfo.pureCommentText) {
        pureCommentText = wrapInfo.pureCommentText;
        leadingTriviaText = leadingWhitespace;
      }

      wrapModifications.push({
        type: "wrapCallExpr",
        sideEffects: wrapInfo.sideEffects,
        pureCommentText: pureCommentText,
        leadingTriviaText: leadingTriviaText,
        fullStart: fullStart,
        end: end,
        callExprText: callExprText,
        leadingWhitespace: leadingWhitespace,
      });
    }

    // Sort by position in reverse order to avoid invalidating later nodes
    wrapModifications.sort((a, b) => b.fullStart - a.fullStart);

    for (const mod of wrapModifications) {
      if (mod.pureCommentText && mod.leadingTriviaText) {
        const newText = `(
${mod.sideEffects},
${mod.pureCommentText} ${mod.callExprText}
)`;

        const newLeadingTriviaText = mod.leadingTriviaText.replace(
          mod.pureCommentText,
          "",
        );

        // By replacing from `getFullStart`, we remove the original node and all its leading trivia
        // and replace it with our manually reconstructed string.
        // This should correctly move the pure comment and preserve other comments and whitespace.
        sourceFile.replaceText(
          [mod.fullStart, mod.end],
          newLeadingTriviaText + newText,
        );
      } else {
        // Extract just the newlines and basic indentation, ignore extra padding
        const leadingNewlines = mod.leadingWhitespace.match(/\n\s*/)?.[0] || "";

        sourceFile.replaceText(
          [mod.fullStart, mod.end],
          `${leadingNewlines}(
${mod.sideEffects},
${mod.callExprText}
)`,
        );
      }
    }

    // Add requestInfo import if needed and not already imported
    if (needsRequestInfoImportRef.value) {
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
        log("Transforming JSX script tags in %s", id);
        process.env.VERBOSE && log("Code:\n%s", code);

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
