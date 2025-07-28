import {
  Project,
  Node,
  SyntaxKind,
  ImportDeclaration,
  CallExpression,
  ObjectLiteralExpression,
  SourceFile,
} from "ts-morph";
import { type Plugin, type ResolvedConfig, type ViteDevServer } from "vite";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";
import { findStylesheetsInGraph } from "./stylesheetDiscovery.mjs";
import debug from "debug";

const log = debug("rwsdk:vite:transform-jsx-script-tags");

const documentEntryPoints = new Map<string, Set<string>>();

export function getDocumentEntryPoints(docId: string): Set<string> {
  return documentEntryPoints.get(docId) ?? new Set();
}

export function getDocumentEntryPointsMap(): Map<string, Set<string>> {
  return documentEntryPoints;
}

export function __test_only_resetDocumentEntryPoints() {
  documentEntryPoints.clear();
}

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
  id: string,
  scriptContent: string,
  manifest: Record<string, any>,
): {
  content: string | undefined;
  hasChanges: boolean;
  entryPoints: Set<string>;
} {
  const scriptProject = new Project({ useInMemoryFileSystem: true });
  const entryPoints = new Set<string>();

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
            log("[%s] Found inline import() to '%s'", id, importPath);
            entryPoints.add(importPath);

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

      return { content: transformedContent, hasChanges: true, entryPoints };
    }

    // Return the original content when no changes are made
    return { content: scriptContent, hasChanges: false, entryPoints };
  } catch (error) {
    // If parsing fails, fall back to the original content
    console.warn("Failed to parse inline script content:", error);
    return { content: undefined, hasChanges: false, entryPoints };
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
  id: string,
  callExpr: CallExpression,
  props: ObjectLiteralExpression,
  manifest: Record<string, any>,
): Promise<{ hasModifications: boolean; entryPoints: Set<string> }> {
  const entryPoints = new Set<string>();
  let hasModifications = false;

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
        log("[%s] Found script with src='%s'", id, srcValue);
        entryPoints.add(srcValue);

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
        log("[%s] Found inline script, transforming its imports...", id);
        const scriptContent = initializer.getLiteralValue();
        const {
          content: transformedContent,
          hasChanges,
          entryPoints: inlineEntryPoints,
        } = transformScriptImports(id, scriptContent, manifest);

        for (const entryPoint of inlineEntryPoints) {
          entryPoints.add(entryPoint);
        }

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

  return { hasModifications, entryPoints };
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

function injectNonces(id: string, nodes: ObjectLiteralExpression[]) {
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
  id: string,
  code: string,
  manifest: Record<string, any> = {},
  projectRootDir: string,
  viteDevServer: ViteDevServer | undefined,
) {
  // context(justinvdm, 15 Jun 2025): Optimization to exit early
  // to avoidunnecessary ts-morph parsing
  if (!hasJsxFunctions(code)) {
    return;
  }
  log("[%s] Starting JSX script tag transformation", id);

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.tsx", code);

  let hasModifications = false;
  const { sdkWorkerImportDecl, hasRequestInfoImport } =
    findRwsdkWorkerImport(sourceFile);

  const scriptsNeedingNonce: ObjectLiteralExpression[] = [];
  const allEntryPoints = new Set<string>();
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
      log("[%s] Found <script> tag, processing...", id);
      const { hasModifications: modified, entryPoints } =
        await transformScriptTag(id, callExpr, props, manifest);

      for (const entryPoint of entryPoints) {
        allEntryPoints.add(entryPoint);
      }

      if (modified) {
        hasModifications = true;
      }

      if (shouldScriptHaveNonce(props)) {
        scriptsNeedingNonce.push(props);
      }
    } else if (tagName === "link") {
      const modified = transformLinkTag(props, manifest);
      if (modified) hasModifications = true;
    }
  }

  log(
    "[%s] Found %d total entry points: %o",
    id,
    allEntryPoints.size,
    allEntryPoints,
  );

  if (allEntryPoints.size > 0) {
    documentEntryPoints.set(id, allEntryPoints);
  }

  let needsRequestInfoImport = false;
  if (scriptsNeedingNonce.length > 0) {
    log(
      "[%s] Injecting nonces into %d script tag(s)",
      id,
      scriptsNeedingNonce.length,
    );
    injectNonces(id, scriptsNeedingNonce);
    hasModifications = true;
    if (!hasRequestInfoImport) {
      needsRequestInfoImport = true;
    }
  }

  // Add requestInfo import if needed and not already imported
  if (needsRequestInfoImport) {
    log("[%s] Adding import for requestInfo from rwsdk/worker", id);
    addRequestInfoImport(sourceFile, sdkWorkerImportDecl);
  }

  log(
    "[%s] %s",
    id,
    hasModifications
      ? "Transformation complete, returning modified code"
      : "No modifications made, returning original code",
  );
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
  let viteDevServer: ViteDevServer | undefined;

  return {
    name: "rwsdk:transform-jsx-script-tags",

    configResolved(resolvedConfig) {
      isBuild = resolvedConfig.command === "build";
      config = resolvedConfig;
    },

    configureServer(server) {
      viteDevServer = server;
    },

    async transform(code, id) {
      if (this.environment.name !== "worker") {
        return;
      }

      // We are only interested in Document files, which are likely to contain
      // script tags. We use a heuristic to identify them.
      if (!/Document\.(t|j)sx?$/.test(id)) {
        return;
      }

      const manifest = isBuild ? await readManifest(manifestPath) : {};

      return transformJsxScriptTagsCode(
        id,
        code,
        manifest,
        config.root,
        viteDevServer,
      );
    },
  };
};
