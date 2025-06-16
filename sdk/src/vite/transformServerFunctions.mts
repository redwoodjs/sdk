import MagicString from "magic-string";
import debug from "debug";
import { hasDirective } from "./hasDirective.mjs";
import { findExports, type ExportInfo } from "./findSpecifiers.mjs";
import { parse as sgParse, Lang as SgLang, Lang } from "@ast-grep/napi";
import path from "path";

const log = debug("rwsdk:vite:transform-server-functions");
const verboseLog = debug("verbose:rwsdk:vite:transform-server-functions");

interface TransformResult {
  code: string;
  map?: any;
}

type ExportInfoCompat = {
  localFunctions: Set<string>;
  reExports: Array<{
    localName: string;
    originalName: string;
    moduleSpecifier: string;
  }>;
};

export const findExportedFunctions = (
  code: string,
  normalizedId?: string,
): Set<string> => {
  return findExportInfo(code, normalizedId).localFunctions;
};

export const findExportInfo = (
  code: string,
  normalizedId?: string,
): ExportInfoCompat => {
  verboseLog("Finding exported functions in source file");

  const localFunctions = new Set<string>();
  const reExports: ExportInfoCompat["reExports"] = [];

  const exportInfos = findExports(normalizedId || "file.ts", code, verboseLog);

  for (const exportInfo of exportInfos) {
    if (exportInfo.isReExport && exportInfo.moduleSpecifier) {
      // For re-exports, we need to determine the original name by parsing the code
      // For "export { default as multiply }", we want localName="multiply", originalName="default"
      // For "export { sum }", we want localName="sum", originalName="sum"

      let originalName = exportInfo.name;

      // Check if this is a default re-export with alias
      if (exportInfo.isDefault && exportInfo.alias) {
        originalName = "default";
      }

      reExports.push({
        localName: exportInfo.name,
        originalName: originalName,
        moduleSpecifier: exportInfo.moduleSpecifier,
      });
      verboseLog(
        "Found re-exported function: %s (original: %s) from %s",
        exportInfo.name,
        originalName,
        exportInfo.moduleSpecifier,
      );
    } else {
      localFunctions.add(exportInfo.name);
      verboseLog("Found exported function: %s", exportInfo.name);
    }
  }

  log(
    "Found %d local functions: %O",
    localFunctions.size,
    Array.from(localFunctions),
  );
  log(
    "Found %d re-exports: %O",
    reExports.length,
    reExports.map((r) => `${r.localName} from ${r.moduleSpecifier}`),
  );

  return { localFunctions, reExports };
};

// Helper function to find default function names using ast-grep
function findDefaultFunctionName(
  code: string,
  normalizedId: string,
): string | null {
  const ext = path.extname(normalizedId).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;

  try {
    const root = sgParse(lang, code);
    const matches = root
      .root()
      .findAll("export default function $NAME($$$) { $$$ }");
    if (matches.length > 0) {
      const nameCapture = matches[0].getMatch("NAME");
      return nameCapture?.text() || null;
    }
  } catch (err) {
    verboseLog("Error finding default function name: %O", err);
  }
  return null;
}

// Helper function to check if there's a default export (not re-export)
function hasDefaultExport(code: string, normalizedId: string): boolean {
  const ext = path.extname(normalizedId).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;

  try {
    const root = sgParse(lang, code);
    // Check for any export default statements
    const patterns = [
      "export default function $$$",
      "export default function($$$) { $$$ }",
      "export default $$$",
    ];

    for (const pattern of patterns) {
      const matches = root.root().findAll(pattern);
      if (matches.length > 0) {
        return true;
      }
    }
  } catch (err) {
    verboseLog("Error checking for default export: %O", err);
  }
  return false;
}

export const transformServerFunctions = (
  code: string,
  normalizedId: string,
  environment: "client" | "worker" | "ssr",
  serverFiles?: Set<string>,
  addServerModule?: (environment: string, id: string) => void,
): TransformResult | undefined => {
  verboseLog(
    "Transform server functions called for normalizedId=%s, environment=%s",
    normalizedId,
    environment,
  );

  if (!hasDirective(code, "use server")) {
    log("Skipping: no 'use server' directive in id=%s", normalizedId);
    verboseLog(
      ":VERBOSE: Returning code unchanged for id=%s:\n%s",
      normalizedId,
      code,
    );
    return;
  }

  log(
    "Processing 'use server' module: normalizedId=%s, environment=%s",
    normalizedId,
    environment,
  );

  addServerModule?.(environment, normalizedId);

  if (environment === "ssr") {
    log("Transforming for SSR environment: normalizedId=%s", normalizedId);

    const exportInfo = findExportInfo(code, normalizedId);
    const allExports = new Set([
      ...exportInfo.localFunctions,
      ...exportInfo.reExports.map((r) => r.localName),
    ]);

    // Check for default function exports that should also be named exports
    const defaultFunctionName = findDefaultFunctionName(code, normalizedId);
    if (defaultFunctionName) {
      allExports.add(defaultFunctionName);
    }

    // Generate completely new code for SSR
    const s = new MagicString("");
    s.append('import { createServerReference } from "rwsdk/__ssr";\n\n');

    for (const name of allExports) {
      if (name !== "default") {
        s.append(
          `export let ${name} = createServerReference(${JSON.stringify(normalizedId)}, ${JSON.stringify(name)});\n`,
        );
        log(
          "Added SSR server reference for function: %s in normalizedId=%s",
          name,
          normalizedId,
        );
      }
    }

    // Check for default export in the actual module (not re-exports)
    if (hasDefaultExport(code, normalizedId)) {
      s.append(
        `\nexport default createServerReference(${JSON.stringify(normalizedId)}, "default");\n`,
      );
      log(
        "Added SSR server reference for default export in normalizedId=%s",
        normalizedId,
      );
    }

    log("SSR transformation complete for normalizedId=%s", normalizedId);
    return {
      code: s.toString(),
      map: s.generateMap({
        source: normalizedId,
        includeContent: true,
        hires: true,
      }),
    };
  } else if (environment === "worker") {
    log("Transforming for worker environment: normalizedId=%s", normalizedId);

    const exportInfo = findExportInfo(code, normalizedId);
    const s = new MagicString(code);

    // Remove "use server" directive first
    const directiveRegex = /^(\s*)(['"]use server['"])\s*;?\s*$/gm;
    let match;
    while ((match = directiveRegex.exec(code)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      s.remove(start, end);
      verboseLog(
        "Removed 'use server' directive from normalizedId=%s",
        normalizedId,
      );
      break; // Only remove the first one
    }

    // Add imports at the very beginning
    let importsToAdd = [];

    // Add imports for re-exported functions so they exist in scope
    for (const reExport of exportInfo.reExports) {
      // Fix the import statement - the originalName is what we import, localName is the alias
      const importStatement =
        reExport.originalName === "default"
          ? `import { default as ${reExport.localName} } from "${reExport.moduleSpecifier}";`
          : reExport.originalName === reExport.localName
            ? `import { ${reExport.originalName} } from "${reExport.moduleSpecifier}";`
            : `import { ${reExport.originalName} as ${reExport.localName} } from "${reExport.moduleSpecifier}";`;

      importsToAdd.push(importStatement);
      log(
        "Added import for re-exported function: %s from %s in normalizedId=%s",
        reExport.localName,
        reExport.moduleSpecifier,
        normalizedId,
      );
    }

    // Add registerServerReference import
    importsToAdd.push(
      'import { registerServerReference } from "rwsdk/worker";',
    );

    // Add imports - position depends on whether file starts with block comment
    if (importsToAdd.length > 0) {
      const trimmedCode = code.trim();
      if (trimmedCode.startsWith("/*")) {
        // Find the end of the block comment
        const blockCommentEnd = code.indexOf("*/");
        if (blockCommentEnd !== -1) {
          // Insert after the block comment
          const insertPos = blockCommentEnd + 2;
          // Find the next newline after the block comment
          const nextNewline = code.indexOf("\n", insertPos);
          const actualInsertPos =
            nextNewline !== -1 ? nextNewline + 1 : insertPos;
          s.appendLeft(actualInsertPos, importsToAdd.join("\n") + "\n");
        } else {
          s.prepend(importsToAdd.join("\n") + "\n");
        }
      } else {
        // No block comment at start, add at beginning
        s.prepend(importsToAdd.join("\n") + "\n");
      }
    }

    // Handle default export renaming if present
    const hasDefExport = hasDefaultExport(code, normalizedId);

    if (hasDefExport) {
      // Find and rename default function export using ast-grep
      const ext = path.extname(normalizedId).toLowerCase();
      const lang =
        ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;

      try {
        const root = sgParse(lang, code);

        // Handle named default function: export default function myFunc() {}
        const namedMatches = root
          .root()
          .findAll("export default function $NAME($$$) { $$$ }");
        if (namedMatches.length > 0) {
          const match = namedMatches[0];
          const range = match.range();
          const funcName = match.getMatch("NAME")?.text();

          if (funcName) {
            // Replace "export default function myFunc" with "function __defaultServerFunction__"
            const newText = match
              .text()
              .replace(
                `export default function ${funcName}`,
                "function __defaultServerFunction__",
              );
            s.overwrite(range.start.index, range.end.index, newText);
            s.append("\nexport default __defaultServerFunction__;\n");
          }
        } else {
          // Handle anonymous default function: export default function() {}
          const anonMatches = root
            .root()
            .findAll("export default function($$$) { $$$ }");
          if (anonMatches.length > 0) {
            const match = anonMatches[0];
            const range = match.range();
            const newText = match
              .text()
              .replace(
                "export default function",
                "function __defaultServerFunction__",
              );
            s.overwrite(range.start.index, range.end.index, newText);
            s.append("\nexport default __defaultServerFunction__;\n");
          }
        }
      } catch (err) {
        verboseLog("Error processing default function: %O", err);
      }
    }

    // Add registration calls at the end
    let registrationCalls = [];
    const registeredFunctions = new Set<string>(); // Track to avoid duplicates

    if (hasDefExport) {
      registrationCalls.push(
        `registerServerReference(__defaultServerFunction__, ${JSON.stringify(normalizedId)}, "default")`,
      );
      registeredFunctions.add("default");
      log(
        "Registered worker server reference for default export in normalizedId=%s",
        normalizedId,
      );
    }

    // Register local functions
    const defaultFunctionName = findDefaultFunctionName(code, normalizedId);
    for (const name of exportInfo.localFunctions) {
      if (name === "__defaultServerFunction__" || name === "default") continue;
      // Skip if already registered
      if (registeredFunctions.has(name)) continue;

      registrationCalls.push(
        `registerServerReference(${name}, ${JSON.stringify(normalizedId)}, ${JSON.stringify(name)})`,
      );
      registeredFunctions.add(name);
      log(
        "Registered worker server reference for local function: %s in normalizedId=%s",
        name,
        normalizedId,
      );
    }

    // Register re-exported functions
    for (const reExport of exportInfo.reExports) {
      // Skip if already registered
      if (registeredFunctions.has(reExport.localName)) continue;

      registrationCalls.push(
        `registerServerReference(${reExport.localName}, ${JSON.stringify(normalizedId)}, ${JSON.stringify(reExport.localName)})`,
      );
      registeredFunctions.add(reExport.localName);
      log(
        "Registered worker server reference for re-exported function: %s in normalizedId=%s",
        reExport.localName,
        normalizedId,
      );
    }

    if (registrationCalls.length > 0) {
      s.append(registrationCalls.join("\n") + "\n");
    }

    log("Worker transformation complete for normalizedId=%s", normalizedId);
    return {
      code: s.toString(),
      map: s.generateMap({
        source: normalizedId,
        includeContent: true,
        hires: true,
      }),
    };
  } else if (environment === "client") {
    log("Transforming for client environment: normalizedId=%s", normalizedId);

    const exportInfo = findExportInfo(code, normalizedId);
    const allExports = new Set([
      ...exportInfo.localFunctions,
      ...exportInfo.reExports.map((r) => r.localName),
    ]);

    // Check for default function exports that should also be named exports
    const defaultFunctionName = findDefaultFunctionName(code, normalizedId);
    if (defaultFunctionName) {
      allExports.add(defaultFunctionName);
    }

    // Generate completely new code for client
    const s = new MagicString("");
    s.append('import { createServerReference } from "rwsdk/client";\n\n');

    for (const name of allExports) {
      if (name !== "default") {
        s.append(
          `export let ${name} = createServerReference(${JSON.stringify(normalizedId)}, ${JSON.stringify(name)});\n`,
        );
        log(
          "Added client server reference for function: %s in normalizedId=%s",
          name,
          normalizedId,
        );
      }
    }

    // Check for default export in the actual module (not re-exports)
    if (hasDefaultExport(code, normalizedId)) {
      s.append(
        `\nexport default createServerReference(${JSON.stringify(normalizedId)}, "default");\n`,
      );
      log(
        "Added client server reference for default export in normalizedId=%s",
        normalizedId,
      );
    }

    log("Client transformation complete for normalizedId=%s", normalizedId);
    return {
      code: s.toString(),
      map: s.generateMap({
        source: normalizedId,
        includeContent: true,
        hires: true,
      }),
    };
  }

  verboseLog(
    "No transformation applied for environment=%s, normalizedId=%s",
    environment,
    normalizedId,
  );
};

export type { TransformResult };
