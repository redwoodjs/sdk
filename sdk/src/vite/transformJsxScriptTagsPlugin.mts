import {
  Project,
  Node,
  SyntaxKind,
  ImportDeclaration,
  CallExpression,
  ObjectLiteralExpression,
  SourceFile,
} from "ts-morph";
import { type Plugin, type ResolvedConfig } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";
import {
  getStylesheetsForEntryPoint,
  type StylesheetContext,
} from "./jsEntryPointsToStylesheetsPlugin.mjs";
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
    log("Read and cached manifest from %s", manifestPath);
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

function isJsxCall(callExpr: CallExpression): "jsx" | "jsxs" | "jsxDEV" | null {
  const expression = callExpr.getExpression();
  const expressionText = expression.getText();

  if (
    expressionText === "jsx" ||
    expressionText === "jsxs" ||
    expressionText === "jsxDEV"
  ) {
    return expressionText;
  }

  return null;
}

function getJsxTagName(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length < 2) return null;

  const elementType = args[0];
  if (!Node.isStringLiteral(elementType)) return null;

  return elementType.getLiteralValue();
}

async function injectStylesheetLinks(
  scriptCall: CallExpression,
  props: ObjectLiteralExpression,
  context: StylesheetContext,
): Promise<boolean> {
  const srcProp = props.getProperty("src");
  if (!srcProp || !Node.isPropertyAssignment(srcProp)) {
    return false;
  }

  const srcInitializer = srcProp.getInitializer();
  if (!Node.isStringLiteral(srcInitializer)) {
    return false;
  }

  const src = srcInitializer.getLiteralValue();
  const stylesheets = await getStylesheetsForEntryPoint(src, context);

  if (stylesheets.length === 0) {
    return false;
  }

  const linkElements = stylesheets.map(
    (href) => `jsx("link", { rel: "stylesheet", href: "${href}" })`,
  );
  const scriptElement = scriptCall.getText();
  const replacement = `[${linkElements.join(", ")}, ${scriptElement}]`;

  scriptCall.replaceWithText(replacement);
  return true;
}

function findRwsdkWorkerImport(sourceFile: SourceFile): {
  sdkWorkerImportDecl: ImportDeclaration | undefined;
  hasRequestInfoImport: boolean;
} {
  let sdkWorkerImportDecl: ImportDeclaration | undefined;
  let hasRequestInfoImport = false;

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

  return { sdkWorkerImportDecl, hasRequestInfoImport };
}

function addRequestInfoImport(
  sourceFile: SourceFile,
  sdkWorkerImportDecl: ImportDeclaration | undefined,
) {
  if (sdkWorkerImportDecl) {
    // Module is imported but need to add requestInfo
    sdkWorkerImportDecl.addNamedImport("requestInfo");
  } else {
    // Add new import declaration
    sourceFile.addImportDeclaration({
      moduleSpecifier: "rwsdk/worker",
      namedImports: ["requestInfo"],
    });
  }
}

async function transformScriptTag(
  callExpr: CallExpression,
  props: ObjectLiteralExpression,
  manifest: Record<string, any>,
  context: StylesheetContext,
) {
  let hasModifications = false;
  const stylesheetInjected = await injectStylesheetLinks(
    callExpr,
    props,
    context,
  );

  if (stylesheetInjected) {
    // The original callExpr was replaced, we can't do more work on its props.
    // The props would need to be re-parsed from the new fragment's script element.
    // For now, we assume this is the only transformation needed for this node.
    // This is a limitation: we won't add a nonce or transform the src of a script
    // that also had stylesheets injected.
    return true;
  }

  const properties = props.getProperties();

  // We loop again because the props might have changed
  for (const prop of properties) {
    if (Node.isPropertyAssignment(prop)) {
      const propName = prop.getName();
      const initializer = prop.getInitializer();

      // Transform src for manifest
      if (
        propName === "src" &&
        (Node.isStringLiteral(initializer) ||
          Node.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        const srcValue = initializer.getLiteralValue();
        if (srcValue.startsWith("/") && manifest[srcValue.slice(1)]) {
          const path = srcValue.slice(1);
          const transformedSrc = manifest[path].file;
          const quote = Node.isNoSubstitutionTemplateLiteral(initializer)
            ? "`"
            : initializer.getText().charAt(0);
          initializer.replaceWithText(`${quote}/${transformedSrc}${quote}`);
          hasModifications = true;
        }
      }

      // Transform inline script children
      if (
        propName === "children" &&
        (Node.isStringLiteral(initializer) ||
          Node.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        const scriptContent = initializer.getLiteralValue();
        const { content: transformedContent, hasChanges } =
          transformScriptImports(scriptContent, manifest);
        if (hasChanges && transformedContent) {
          const quote = Node.isNoSubstitutionTemplateLiteral(initializer)
            ? ""
            : '"';
          const replacement = Node.isNoSubstitutionTemplateLiteral(initializer)
            ? "`" + transformedContent + "`"
            : JSON.stringify(transformedContent);
          initializer.replaceWithText(replacement);
          hasModifications = true;
        }
      }
    }
  }

  return hasModifications;
}

function shouldScriptHaveNonce(props: ObjectLiteralExpression): boolean {
  let hasDangerouslySetInnerHTML = false;
  let hasNonce = false;
  let hasChildren = false;
  let hasSrc = false;

  for (const prop of props.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const propName = prop.getName();
      if (propName === "nonce") hasNonce = true;
      if (propName === "dangerouslySetInnerHTML")
        hasDangerouslySetInnerHTML = true;
      if (propName === "children") hasChildren = true;
      if (propName === "src") hasSrc = true;
    }
  }

  return !hasNonce && !hasDangerouslySetInnerHTML && (hasChildren || hasSrc);
}

function injectNonces(nodes: ObjectLiteralExpression[]) {
  for (const props of nodes) {
    props.addPropertyAssignment({
      name: "nonce",
      initializer: "requestInfo.rw.nonce",
    });
  }
}

function transformLinkTag(
  props: ObjectLiteralExpression,
  manifest: Record<string, any>,
) {
  let isPreload = false;
  let hrefValue = null;
  let hrefInitializer: Node | undefined;

  for (const prop of props.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const propName = prop.getName();
      const initializer = prop.getInitializer();
      if (
        propName === "rel" &&
        initializer &&
        Node.isStringLiteral(initializer)
      ) {
        const relValue = initializer.getLiteralValue();
        if (relValue === "preload" || relValue === "modulepreload") {
          isPreload = true;
        }
      }
      if (
        propName === "href" &&
        initializer &&
        Node.isStringLiteral(initializer)
      ) {
        hrefInitializer = initializer;
        hrefValue = initializer.getLiteralValue();
      }
    }
  }

  if (
    isPreload &&
    hrefValue &&
    hrefInitializer &&
    hrefValue.startsWith("/") &&
    manifest[hrefValue.slice(1)]
  ) {
    const path = hrefValue.slice(1);
    const transformedHref = manifest[path].file;
    const quote = (hrefInitializer as any).getText().charAt(0);
    (hrefInitializer as any).replaceWithText(
      `${quote}/${transformedHref}${quote}`,
    );
    return true;
  }

  return false;
}

export async function transformJsxScriptTagsCode(
  code: string,
  manifest: Record<string, any> = {},
  context: StylesheetContext,
) {
  // context(justinvdm, 15 Jun 2025): Optimization to exit early
  // to avoidunnecessary ts-morph parsing
  if (!hasJsxFunctions(code)) {
    return;
  }

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.tsx", code);

  let hasModifications = false;
  const { sdkWorkerImportDecl, hasRequestInfoImport } =
    findRwsdkWorkerImport(sourceFile);

  const scriptsNeedingNonce: ObjectLiteralExpression[] = [];
  const callExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  );

  // Look for jsx function calls (jsx, jsxs, jsxDEV)
  for (const callExpr of callExpressions) {
    if (!isJsxCall(callExpr)) {
      continue;
    }

    const tagName = getJsxTagName(callExpr);
    if (!tagName) {
      continue;
    }

    const props = callExpr.getArguments()[1];
    if (!Node.isObjectLiteralExpression(props)) {
      continue;
    }

    if (tagName === "script") {
      const modified = await transformScriptTag(
        callExpr,
        props,
        manifest,
        context,
      );
      if (modified) {
        hasModifications = true;
        // If the node was replaced (e.g., by stylesheet injection),
        // we should skip the rest of the logic for this node.
        if (callExpr.wasForgotten()) {
          continue;
        }
      }

      if (shouldScriptHaveNonce(props)) {
        scriptsNeedingNonce.push(props);
      }
    } else if (tagName === "link") {
      const modified = transformLinkTag(props, manifest);
      if (modified) hasModifications = true;
    }
  }

  let needsRequestInfoImport = false;
  if (scriptsNeedingNonce.length > 0) {
    injectNonces(scriptsNeedingNonce);
    hasModifications = true;
    if (!hasRequestInfoImport) {
      needsRequestInfoImport = true;
    }
  }

  // Add requestInfo import if needed and not already imported
  if (needsRequestInfoImport) {
    addRequestInfoImport(sourceFile, sdkWorkerImportDecl);
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
  let config: ResolvedConfig;

  return {
    name: "rwsdk:transform-jsx-script-tags",

    configResolved(resolvedConfig) {
      isBuild = resolvedConfig.command === "build";
      config = resolvedConfig;
    },

    async transform(code) {
      if (this.environment.name !== "worker") {
        return;
      }

      const manifest = isBuild ? await readManifest(manifestPath) : {};
      const context: StylesheetContext = {
        isBuild,
        projectRootDir: config.root,
        buildOutDir: config.build.outDir,
      };

      return transformJsxScriptTagsCode(code, manifest, context);
    },
  };
};
