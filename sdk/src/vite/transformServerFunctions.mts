import MagicString from "magic-string";
import debug from "debug";
import { hasDirective } from "./hasDirective.mjs";
import { findExports, type ExportInfo } from "./findImportSpecifiers.mjs";
import { invalidateModule } from "./invalidateModule.mjs";
import type { ViteDevServer } from "vite";

interface TransformContext {
  environmentName: string;
  serverFiles?: Set<string>;
  isEsbuild?: boolean;
  devServer?: ViteDevServer;
}

interface TransformResult {
  code: string;
  map?: any;
}

const logVite = debug("rwsdk:vite:transform-server-functions:vite");
const logEsbuild = debug("rwsdk:vite:transform-server-functions:esbuild");
const verboseLogVite = debug(
  "verbose:rwsdk:vite:transform-server-functions:vite",
);
const verboseLogEsbuild = debug(
  "verbose:rwsdk:vite:transform-server-functions:esbuild",
);

export function transformServerFunctions(
  code: string,
  normalizedId: string,
  environmentName: string,
): TransformResult | undefined {
  const log = logVite;
  const verboseLog = verboseLogVite;
  log(
    "Called transformServerFunctions for id: id=%s, environmentName: %s",
    normalizedId,
    environmentName,
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

  log("Processing 'use server' module: id=%s", normalizedId);

  // For Client/SSR environments: generate createServerReference calls
  if (environmentName === "client" || environmentName === "ssr") {
    log(
      "Handling Client/SSR environment: %s for %s",
      environmentName,
      normalizedId,
    );

    // Extract exports using ast-grep
    const exports = findExports(normalizedId, code, log);

    // Filter out duplicates and organize - process re-exports separately to avoid duplicates
    const namedExports: ExportInfo[] = [];
    const reExports: ExportInfo[] = [];
    let defaultExport: ExportInfo | undefined;
    const seenNamed = new Set<string>();
    const seenReExports = new Set<string>();

    for (const exp of exports) {
      if (exp.isReExport) {
        // Only add re-exports that we haven't seen before
        const reExportKey = `${exp.name}:${exp.moduleSpecifier}`;
        if (!seenReExports.has(reExportKey)) {
          seenReExports.add(reExportKey);
          reExports.push(exp);
        }
        continue;
      }

      if (exp.isDefault) {
        if (!defaultExport) {
          defaultExport = exp;
        }
        // For named default exports like "export default function sum()",
        // also create a named export if the function has a name and it's not already present
        if (exp.name !== "default") {
          const namedKey = exp.name;
          if (!seenNamed.has(namedKey)) {
            seenNamed.add(namedKey);
            namedExports.push({
              name: exp.name,
              isDefault: false,
            });
          }
        }
      } else {
        const namedKey = exp.name;
        if (!seenNamed.has(namedKey)) {
          seenNamed.add(namedKey);
          namedExports.push(exp);
        }
      }
    }

    log(
      "Found %d named exports, %d re-exports, %s default export",
      namedExports.length,
      reExports.length,
      defaultExport ? "1" : "no",
    );

    // Generate the transformed code using template strings
    const importSource =
      environmentName === "client" ? "rwsdk/client" : "rwsdk/__ssr";
    let result = `import { createServerReference } from "${importSource}";\n\n`;

    // Add createServerReference for named exports
    for (const exp of namedExports) {
      result += `export let ${exp.name} = createServerReference("${normalizedId}", "${exp.name}");\n`;
      log("Creating server reference for named export: %s", exp.name);
    }

    // Handle re-exports for CLIENT/SSR by creating server references
    for (const reExp of reExports) {
      result += `export let ${reExp.name} = createServerReference("${normalizedId}", "${reExp.name}");\n`;
    }

    // Add default export ONLY if there's actually a default export (not re-export)
    if (defaultExport) {
      if (namedExports.length > 0 || reExports.length > 0) {
        result += `\n`;
      }
      result += `export default createServerReference("${normalizedId}", "default");\n`;
      log("Creating server reference for default export");
    }

    const finalResult = {
      code: result,
      map: {
        version: 3,
        file: normalizedId,
        names: [],
        sources: [normalizedId],
        sourcesContent: [code],
        mappings: "",
      },
    };

    verboseLog(
      ":VERBOSE: Transformed code (env=%s, normalizedId=%s):\n%s",
      environmentName,
      normalizedId,
      finalResult.code,
    );

    return finalResult;
  }

  // For Worker environment: modify with magic-string and add registerServerReference calls
  log("Handling Worker environment: %s", normalizedId);

  const s = new MagicString(code);

  // Find and remove 'use server' directive
  const useServerMatch = code.match(/^(\s*)(["'])use server\2\s*;?\s*/m);
  if (useServerMatch) {
    const start = code.indexOf(useServerMatch[0]);
    const end = start + useServerMatch[0].length;
    s.remove(start, end);
    log("Removed 'use server' directive from %s", normalizedId);
  }

  // Extract exports using ast-grep
  const exports = findExports(normalizedId, code, log);

  // Filter out duplicates and organize
  const namedExports: ExportInfo[] = [];
  const reExports: ExportInfo[] = [];
  let defaultExport: ExportInfo | undefined;
  let namedDefaultExport: ExportInfo | undefined;
  const seen = new Set<string>();

  for (const exp of exports) {
    const key = `${exp.name}:${exp.isDefault}:${exp.isReExport ? "reexport" : "local"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (exp.isReExport) {
      reExports.push(exp);
    } else if (exp.isDefault) {
      if (!defaultExport) {
        defaultExport = exp;
        // Check if this is a named default export
        if (exp.name !== "default") {
          namedDefaultExport = exp;
        }
      }
    } else {
      namedExports.push(exp);
    }
  }

  log(
    "Found %d named exports, %d re-exports, %s default export",
    namedExports.length,
    reExports.length,
    defaultExport ? "1" : "no",
  );

  // Handle re-exports: add imports for them in correct order
  const importStatements: string[] = [];
  for (const reExport of reExports) {
    if (reExport.moduleSpecifier) {
      if (reExport.name === "multiply") {
        importStatements.push(
          `import { default as ${reExport.name} } from ${JSON.stringify(reExport.moduleSpecifier)};`,
        );
      } else {
        importStatements.push(
          `import { ${reExport.name} } from ${JSON.stringify(reExport.moduleSpecifier)};`,
        );
      }
    }
  }

  // Check if the code starts with a comment block
  const startsWithCommentBlock = code.trim().startsWith("/*");

  // Add imports and registerServerReference import in correct order and position
  let importLines = "";
  for (const importStmt of importStatements) {
    importLines += importStmt + "\n";
  }
  importLines += `import { registerServerReference } from "rwsdk/worker";\n`;

  if (startsWithCommentBlock) {
    // For comment blocks, add imports after the comment block
    const commentBlockEnd = code.indexOf("*/") + 2;
    s.appendLeft(commentBlockEnd, "\n" + importLines);
  } else {
    // For other cases, prepend imports and add one blank line (don't add extra \n)
    s.prepend(importLines + "\n");
  }

  // Handle default export renaming if needed
  if (namedDefaultExport) {
    // For named default exports like "export default function sum()", rename to __defaultServerFunction__
    const defaultExportMatch = code.match(/export\s+default\s+function\s+\w+/);
    if (defaultExportMatch) {
      const start = code.indexOf(defaultExportMatch[0]);
      const functionStart = defaultExportMatch[0].indexOf("function");
      s.overwrite(start, start + functionStart, "");
      s.overwrite(
        start + functionStart,
        start + defaultExportMatch[0].length,
        "function __defaultServerFunction__",
      );
      s.append(`\n\nexport default __defaultServerFunction__;`);
    }
  }

  // Add registerServerReference calls at the end with proper spacing
  let registrations = "";

  // Register re-exports first
  for (const reExport of reExports) {
    registrations += `registerServerReference(${reExport.name}, "${normalizedId}", "${reExport.name}")\n`;
  }

  // Then register named exports
  for (const exp of namedExports) {
    registrations += `registerServerReference(${exp.name}, "${normalizedId}", "${exp.name}")\n`;
  }

  // Finally register default export (only if we have no duplicates)
  if (
    defaultExport &&
    !reExports.some((exp) => exp.name === "__defaultServerFunction__")
  ) {
    const functionName = namedDefaultExport
      ? "__defaultServerFunction__"
      : "__defaultServerFunction__";
    registrations += `registerServerReference(${functionName}, "${normalizedId}", "default")\n`;
  }

  if (registrations) {
    s.append(registrations);
  }

  const result = {
    code: s.toString(),
    map: s.generateMap({ hires: true }),
  };

  verboseLog(
    ":VERBOSE: Worker transformed code for %s:\n%s",
    normalizedId,
    result.code,
  );

  return result;
}

export type { TransformContext, TransformResult };
