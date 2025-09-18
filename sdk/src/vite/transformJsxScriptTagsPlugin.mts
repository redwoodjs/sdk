import {
  Project,
  Node,
  SyntaxKind,
  ImportDeclaration,
  CallExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
} from "ts-morph";
import { type Plugin } from "vite";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:transform-jsx-script-tags");

function transformAssetPath(
  importPath: string,
  projectRootDir: string,
): string {
  if (process.env.VITE_IS_DEV_SERVER === "1") {
    return importPath;
  }
  const normalizedImportPath = normalizeModulePath(importPath, projectRootDir);
  return `rwsdk_asset:${normalizedImportPath}`;
}

// Note: This plugin only runs during discovery phase (Phase 1)
// Manifest reading and asset linking happens later in Phase 5

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

function transformScriptImports(
  scriptContent: string,
  clientEntryPoints: Set<string>,
  manifest: Record<string, any>,
  projectRootDir: string,
): {
  content: string | undefined;
  hasChanges: boolean;
  entryPoints: string[];
} {
  const scriptProject = new Project({ useInMemoryFileSystem: true });

  try {
    const wrappedContent = `function __wrapper() {${scriptContent}}`;
    const scriptFile = scriptProject.createSourceFile(
      "script.js",
      wrappedContent,
    );

    let hasChanges = false;
    const entryPoints: string[] = [];

    scriptFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .forEach((callExpr) => {
        const expr = callExpr.getExpression();

        const isImport = expr.getText() === "import";

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
              clientEntryPoints.add(importPath);

              const transformedImportPath = transformAssetPath(
                importPath,
                projectRootDir,
              );
              args[0].setLiteralValue(transformedImportPath);
              hasChanges = true;
            }
          }
        }
      });

    if (hasChanges) {
      const fullText = scriptFile.getFullText();
      const startPos = fullText.indexOf("{") + 1;
      const endPos = fullText.lastIndexOf("}");
      const transformedContent = fullText.substring(startPos, endPos);

      return { content: transformedContent, hasChanges: true, entryPoints };
    }

    return { content: scriptContent, hasChanges: false, entryPoints };
  } catch (error) {
    console.warn("Failed to parse inline script content:", error);
    return { content: undefined, hasChanges: false, entryPoints: [] };
  }
}

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
  callExprText: string;
  leadingWhitespace: string;
}

interface RemoveCallExprModification {
  type: "removeCallExpr";
  sideEffects: string;
  fullStart: number;
  end: number;
}

type Modification =
  | LiteralValueModification
  | ReplaceTextModification
  | AddPropertyModification
  | WrapCallExprModification
  | RemoveCallExprModification;

export async function transformJsxScriptTagsCode(
  code: string,
  clientEntryPoints: Set<string>,
  manifest: Record<string, any> = {},
  projectRootDir: string,
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
    {
      callExpr: CallExpression;
      sideEffects: string;
      pureCommentText?: string;
      isRemoval?: boolean;
      fullStart?: number;
      end?: number;
      leadingWhitespace?: string;
    }
  >();

  let hasRequestInfoImport = false;
  let sdkWorkerImportDecl: ImportDeclaration | undefined;

  sourceFile.getImportDeclarations().forEach((importDecl) => {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    if (moduleSpecifier === "rwsdk/worker") {
      sdkWorkerImportDecl = importDecl;
      if (
        importDecl
          .getNamedImports()
          .some((namedImport) => namedImport.getName() === "requestInfo")
      ) {
        hasRequestInfoImport = true;
      }
    }
  });

  sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .forEach((callExpr) => {
      const expression = callExpr.getExpression();
      const expressionText = expression.getText();

      if (
        expressionText !== "jsx" &&
        expressionText !== "jsxs" &&
        expressionText !== "jsxDEV"
      ) {
        return;
      }

      const args = callExpr.getArguments();
      if (args.length < 2) return;

      const elementType = args[0];
      if (!Node.isStringLiteral(elementType)) return;

      const tagName = elementType.getLiteralValue();
      const entryPoints: string[] = [];
      let isEntryPointScript = false;
      let entryScriptSideEffects: string[] = [];

      if (tagName === "script" || tagName === "link") {
        console.log(
          "[DEBUG] transformJsxScriptTagsPlugin - Processing tag:",
          tagName,
        );
        const propsArg = args[1];

        if (Node.isObjectLiteralExpression(propsArg)) {
          const properties = propsArg.getProperties();

          let hasDangerouslySetInnerHTML = false;
          let hasNonce = false;
          let hasStringLiteralChildren = false;
          let hasSrc = false;
          let isPreload = false;
          let hrefProp: PropertyAssignment | undefined;

          for (const prop of properties) {
            if (Node.isPropertyAssignment(prop)) {
              const propName = prop.getName();
              const initializer = prop.getInitializer();

              if (propName === "nonce") {
                hasNonce = true;
              }

              if (propName === "dangerouslySetInnerHTML") {
                hasDangerouslySetInnerHTML = true;
              }

              if (tagName === "script" && propName === "src") {
                hasSrc = true;

                if (
                  Node.isStringLiteral(initializer) ||
                  Node.isNoSubstitutionTemplateLiteral(initializer)
                ) {
                  const srcValue = initializer.getLiteralValue();

                  if (srcValue.startsWith("/")) {
                    entryPoints.push(srcValue);
                    clientEntryPoints.add(srcValue);

                    const transformedSrc = transformAssetPath(
                      srcValue,
                      projectRootDir,
                    );

                    modifications.push({
                      type: "literalValue",
                      node: initializer,
                      value: transformedSrc,
                    });
                  }
                }
              }

              if (
                tagName === "script" &&
                propName === "children" &&
                (Node.isStringLiteral(initializer) ||
                  Node.isNoSubstitutionTemplateLiteral(initializer))
              ) {
                hasStringLiteralChildren = true;

                const scriptContent = initializer.getLiteralValue();

                const {
                  content: transformedContent,
                  hasChanges: contentHasChanges,
                  entryPoints: dynamicEntryPoints,
                } = transformScriptImports(
                  scriptContent,
                  clientEntryPoints,
                  manifest,
                  projectRootDir,
                );

                entryPoints.push(...dynamicEntryPoints);

                if (contentHasChanges && transformedContent) {
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

              if (
                tagName === "link" &&
                propName === "rel" &&
                initializer &&
                (Node.isStringLiteral(initializer) ||
                  Node.isNoSubstitutionTemplateLiteral(initializer))
              ) {
                const relValue = initializer.getLiteralValue();
                if (relValue === "preload" || relValue === "modulepreload") {
                  isPreload = true;
                }
              }

              if (tagName === "link" && propName === "href") {
                hrefProp = prop;
              }
            }
          }

          if (isPreload && hrefProp) {
            const initializer = hrefProp.getInitializer();
            if (
              initializer &&
              (Node.isStringLiteral(initializer) ||
                Node.isNoSubstitutionTemplateLiteral(initializer))
            ) {
              const hrefValue = initializer.getLiteralValue();
              if (hrefValue.startsWith("/")) {
                const transformedHref = transformAssetPath(
                  hrefValue,
                  projectRootDir,
                );
                modifications.push({
                  type: "literalValue",
                  node: initializer,
                  value: transformedHref,
                });
              }
            }
          }

          // Check if this is an entry point script that should be removed and handled by React's bootstrap
          if (tagName === "script") {
            // Case 1: External entry script (e.g., <script src="/src/client.tsx">)
            if (hasSrc && entryPoints.length > 0) {
              isEntryPointScript = true;
              entryScriptSideEffects = entryPoints.map(
                (p) =>
                  `(console.log("[DEBUG] Document execution - Adding external entry script:", "${p}"), requestInfo.rw.entryScripts.add("${p}"))`,
              );
              log("Detected external entry script with src: %o", entryPoints);
              console.log(
                "[DEBUG] transformJsxScriptTagsPlugin - Detected external entry script:",
                entryPoints,
              );
            }
            // Case 2: Inline entry script (e.g., <script>import("/src/client.tsx")</script>)
            else if (hasStringLiteralChildren && entryPoints.length > 0) {
              isEntryPointScript = true;
              const childrenProp = properties.find(
                (prop) =>
                  Node.isPropertyAssignment(prop) &&
                  prop.getName() === "children",
              );

              const scriptContent =
                childrenProp && Node.isPropertyAssignment(childrenProp)
                  ? childrenProp.getInitializer()?.getText()?.slice(1, -1) // Remove quotes
                  : undefined;

              if (scriptContent) {
                console.log(
                  "[DEBUG] transformJsxScriptTagsPlugin - Detected inline entry script:",
                  entryPoints,
                  "content:",
                  scriptContent,
                );
                entryScriptSideEffects = [
                  `(console.log("[DEBUG] Document execution - Adding inline script:", ${JSON.stringify(scriptContent)}), requestInfo.rw.inlineScripts.add(${JSON.stringify(scriptContent)}))`,
                  ...entryPoints.map(
                    (p) =>
                      `(console.log("[DEBUG] Document execution - Adding script to be loaded:", "${p}"), requestInfo.rw.scriptsToBeLoaded.add("${p}"))`,
                  ),
                ];
                log(
                  "Detected inline entry script with content: %s",
                  scriptContent,
                );
              }
            }
          }

          if (
            tagName === "script" &&
            !hasNonce &&
            !hasDangerouslySetInnerHTML &&
            (hasStringLiteralChildren || hasSrc) &&
            !isEntryPointScript
          ) {
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

          // Note: Link preload href transformations happen in Phase 5 (Asset Linking)
          // During discovery phase, we only transform script tags
        }
      }

      // Handle entry point scripts - either remove them entirely or wrap them
      if (entryPoints.length > 0) {
        log(
          "Found %d script entry points: %o",
          entryPoints.length,
          entryPoints,
        );

        if (isEntryPointScript && entryScriptSideEffects.length > 0) {
          // Entry point scripts get removed entirely and replaced with side effects
          log("Removing entry point script and adding side effects");

          const sideEffects = entryScriptSideEffects.join(",\n");

          // For removal, we'll use a special marker that gets replaced with null
          entryPointsPerCallExpr.set(callExpr, {
            callExpr: callExpr,
            sideEffects: sideEffects,
            isRemoval: true,
          });
        } else {
          // Regular scripts get wrapped with scriptsToBeLoaded side effects
          const sideEffects = entryPoints
            .map((p) => `(requestInfo.rw.scriptsToBeLoaded.add("${p}"))`)
            .join(",\n");

          const leadingCommentRanges = callExpr.getLeadingCommentRanges();
          const pureComment = leadingCommentRanges.find((r) =>
            r.getText().includes("@__PURE__"),
          );

          const wrapInfo = {
            callExpr: callExpr,
            sideEffects: sideEffects,
            pureCommentText: pureComment?.getText(),
            isRemoval: false,
          };

          if (!entryPointsPerCallExpr.has(callExpr)) {
            entryPointsPerCallExpr.set(callExpr, wrapInfo);
          }
        }

        needsRequestInfoImportRef.value = true;
      }
    });

  if (modifications.length > 0 || entryPointsPerCallExpr.size > 0) {
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

    const callExprModifications: (
      | WrapCallExprModification
      | RemoveCallExprModification
    )[] = [];

    for (const [callExpr, wrapInfo] of entryPointsPerCallExpr) {
      if (wrapInfo.isRemoval) {
        // Entry point scripts get removed entirely
        callExprModifications.push({
          type: "removeCallExpr",
          sideEffects: wrapInfo.sideEffects,
          fullStart: callExpr.getFullStart(),
          end: callExpr.getEnd(),
        });
      } else {
        // Regular scripts get wrapped
        const fullStart = callExpr.getFullStart();
        const end = callExpr.getEnd();
        const callExprText = callExpr.getText();
        const fullText = callExpr.getFullText();

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

        callExprModifications.push({
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
    }

    callExprModifications.sort((a, b) => b.fullStart - a.fullStart);

    for (const mod of callExprModifications) {
      if (mod.type === "removeCallExpr") {
        // Replace the entire JSX call with just the side effects wrapped in an expression that evaluates to null
        const replacementText = `(${mod.sideEffects}, null)`;
        console.log(
          "[DEBUG] transformJsxScriptTagsPlugin - Replacing script with:",
          replacementText,
        );
        sourceFile.replaceText([mod.fullStart, mod.end], replacementText);
      } else if (mod.type === "wrapCallExpr") {
        if (mod.pureCommentText && mod.leadingTriviaText) {
          const newText = `(
${mod.sideEffects},
${mod.pureCommentText} ${mod.callExprText}
)`;

          const newLeadingTriviaText = mod.leadingTriviaText.replace(
            mod.pureCommentText,
            "",
          );

          sourceFile.replaceText(
            [mod.fullStart, mod.end],
            newLeadingTriviaText + newText,
          );
        } else {
          const leadingNewlines =
            mod.leadingWhitespace.match(/\n\s*/)?.[0] || "";

          sourceFile.replaceText(
            [mod.fullStart, mod.end],
            `${leadingNewlines}(
${mod.sideEffects},
${mod.callExprText}
)`,
          );
        }
      }
    }

    if (needsRequestInfoImportRef.value) {
      if (sdkWorkerImportDecl) {
        if (!hasRequestInfoImport) {
          sdkWorkerImportDecl.addNamedImport("requestInfo");
        }
      } else {
        sourceFile.addImportDeclaration({
          moduleSpecifier: "rwsdk/worker",
          namedImports: ["requestInfo"],
        });
      }
    }

    const finalCode = sourceFile.getFullText();
    console.log(
      "[DEBUG] transformJsxScriptTagsPlugin - Final transformed code:",
    );
    console.log(finalCode);

    return {
      code: finalCode,
      map: null,
    };
  }

  return;
}

export const transformJsxScriptTagsPlugin = ({
  clientEntryPoints,
  projectRootDir,
}: {
  clientEntryPoints: Set<string>;
  projectRootDir: string;
}): Plugin => {
  let isBuild = false;

  return {
    name: "rwsdk:vite:transform-jsx-script-tags",
    configResolved(config) {
      isBuild = config.command === "build";
      console.log(
        "[DEBUG] transformJsxScriptTagsPlugin - Plugin loaded, isBuild:",
        isBuild,
      );
    },
    async transform(code, id) {
      console.log(
        "[DEBUG] transformJsxScriptTagsPlugin - transform called for:",
        id,
        "environment:",
        this.environment?.name,
      );

      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        console.log(
          "[DEBUG] transformJsxScriptTagsPlugin - Skipping due to directive scan",
        );
        return;
      }

      if (
        isBuild &&
        this.environment?.name === "worker" &&
        process.env.RWSDK_BUILD_PASS !== "worker"
      ) {
        return null;
      }

      if (
        this.environment?.name === "worker" &&
        id.endsWith(".tsx") &&
        !id.includes("node_modules") &&
        hasJsxFunctions(code)
      ) {
        log("Transforming JSX script tags in %s", id);
        console.log(
          "[DEBUG] transformJsxScriptTagsPlugin - Processing file:",
          id,
        );
        process.env.VERBOSE && log("Code:\n%s", code);

        // During discovery phase, never use manifest - it doesn't exist yet
        const result = await transformJsxScriptTagsCode(
          code,
          clientEntryPoints,
          {}, // Empty manifest during discovery
          projectRootDir,
        );
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
