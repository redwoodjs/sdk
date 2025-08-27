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
import path from "node:path";
import debug from "debug";

const log = debug("rwsdk:vite:transform-jsx-script-tags");

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
  manifest: Record<string, any>,
  isDiscovery: boolean,
  clientEntryPoints: Set<string>,
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
    const localEntryPoints: string[] = [];

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
              localEntryPoints.push(importPath);

              const path = importPath.slice(1);

              if (isDiscovery) {
                clientEntryPoints.add(importPath);
                const transformedSrc = `rwsdk_asset:${importPath}`;
                args[0].setLiteralValue(transformedSrc);
                hasChanges = true;
              } else if (manifest[path]) {
                const transformedSrc = `/${manifest[path].file}`;
                args[0].setLiteralValue(transformedSrc);
                hasChanges = true;
              }
            }
          }
        }
      });

    if (hasChanges) {
      const fullText = scriptFile.getFullText();
      const startPos = fullText.indexOf("{") + 1;
      const endPos = fullText.lastIndexOf("}");
      const transformedContent = fullText.substring(startPos, endPos);

      return {
        content: transformedContent,
        hasChanges: true,
        entryPoints: localEntryPoints,
      };
    }

    return {
      content: scriptContent,
      hasChanges: false,
      entryPoints: localEntryPoints,
    };
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

type Modification =
  | LiteralValueModification
  | ReplaceTextModification
  | AddPropertyModification
  | WrapCallExprModification;

export async function transformJsxScriptTagsCode(
  code: string,
  isDiscovery: boolean,
  clientEntryPoints: Set<string>,
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

      if (tagName === "script" || tagName === "link") {
        const propsArg = args[1];

        if (Node.isObjectLiteralExpression(propsArg)) {
          const properties = propsArg.getProperties();

          let hasDangerouslySetInnerHTML = false;
          let hasNonce = false;
          let hasStringLiteralChildren = false;
          let hasSrc = false;

          let isPreload = false;
          let hrefValue = null;

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

                    if (isDiscovery) {
                      clientEntryPoints.add(srcValue);
                      const transformedSrc = `rwsdk_asset:${srcValue}`;
                      modifications.push({
                        type: "literalValue",
                        node: initializer,
                        value: transformedSrc,
                      });
                    } else {
                      const path = srcValue.slice(1);
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
                  manifest,
                  isDiscovery,
                  clientEntryPoints,
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

          if (
            tagName === "script" &&
            !hasNonce &&
            !hasDangerouslySetInnerHTML &&
            (hasStringLiteralChildren || hasSrc)
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

          if (
            tagName === "link" &&
            isPreload &&
            hrefValue &&
            hrefValue.startsWith("/") &&
            manifest[hrefValue.slice(1)]
          ) {
            const path = hrefValue.slice(1);
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

        const wrapInfo = {
          callExpr: callExpr,
          sideEffects: sideEffects,
          pureCommentText: pureComment?.getText(),
        };

        if (!entryPointsPerCallExpr.has(callExpr)) {
          entryPointsPerCallExpr.set(callExpr, wrapInfo);
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

    const wrapModifications: WrapCallExprModification[] = [];

    for (const [callExpr, wrapInfo] of entryPointsPerCallExpr) {
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

        sourceFile.replaceText(
          [mod.fullStart, mod.end],
          newLeadingTriviaText + newText,
        );
      } else {
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

    return {
      code: sourceFile.getFullText(),
      map: null,
    };
  }

  return;
}

export const transformJsxScriptTagsPlugin = ({
  clientEntryPoints,
}: {
  clientEntryPoints: Set<string>;
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

        const result = await transformJsxScriptTagsCode(
          code,
          isBuild,
          clientEntryPoints,
          isBuild ? undefined : {},
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
