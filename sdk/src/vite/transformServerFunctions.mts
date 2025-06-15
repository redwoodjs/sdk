import debug from "debug";
import { hasDirective } from "./hasDirective.mjs";
import { findExports, type ExportInfo } from "./findImportSpecifiers.mjs";
import { invalidateModule } from "./invalidateModule.mjs";
import type { ViteDevServer } from "vite";

const log = debug("rwsdk:vite:transform-server-functions");
const verboseLog = debug("verbose:rwsdk:vite:transform-server-functions");

interface TransformResult {
  code: string;
  map: any | null;
}

interface TransformContext {
  serverFiles?: Set<string>;
  isEsbuild?: boolean;
  devServer?: ViteDevServer;
}

// Creates a minimal, valid sourcemap linking generated output back to the original file.
function createEmptySourceMap(originalCode: string, id: string) {
  return {
    version: 3,
    file: id,
    names: [],
    sources: [id],
    sourcesContent: [originalCode],
    mappings: "", // No mappings, treated as generated code without positions
  };
}

/**
 * Overloaded helper: resolve the optional context argument which may be a Set<string>
 * (for historical compatibility) or a full context object.
 */
function resolveCtx(
  ctxLike?: Set<string> | TransformContext,
): TransformContext {
  if (!ctxLike) return {};
  if (ctxLike instanceof Set) {
    return { serverFiles: ctxLike };
  }
  return ctxLike;
}

export function transformServerFunctions(
  code: string,
  normalizedId: string,
  environment: "client" | "worker" | "ssr",
  ctxLike?: Set<string> | TransformContext,
): TransformResult | undefined {
  verboseLog(
    "Called transformServerFunctions: id=%s, env=%s, ctx=%O",
    normalizedId,
    environment,
    ctxLike,
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

  const ctx = resolveCtx(ctxLike);

  // Track file as server file
  ctx.serverFiles?.add(normalizedId);

  // Invalidate the lookup module when a server file is added (vite runtime only)
  if (ctx.devServer && !ctx.isEsbuild) {
    try {
      invalidateModule(
        ctx.devServer,
        environment,
        "virtual:use-server-lookup",
        log,
        verboseLog,
      );
      log(
        "Invalidated use-server-lookup module for environment: %s",
        environment,
      );
    } catch (error) {
      verboseLog("Failed to invalidate use-server-lookup module: %O", error);
    }
  }

  // ----------------------------------------
  // Gather export information
  // ----------------------------------------
  const exportInfos = findExports(normalizedId, code, log);

  const namedExports: ExportInfo[] = [];
  let defaultExport: ExportInfo | undefined;

  const seen = new Set<string>();
  for (const exp of exportInfos) {
    const key = `${exp.name}:${exp.isDefault}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (exp.isDefault && !exp.isReExport) {
      // Local default export
      if (!defaultExport) defaultExport = exp;
      // Also expose the function name (if it has one) as a named export for parity with previous behaviour
      if (exp.name && exp.name !== "default") {
        const dupKey = `${exp.name}:false`;
        if (!seen.has(dupKey)) {
          namedExports.push({ ...exp, isDefault: false });
          seen.add(dupKey);
        }
      }
    } else {
      namedExports.push(exp);
    }
  }

  log(
    "Found %d named exports, %s default export",
    namedExports.length,
    defaultExport ? "1" : "no",
  );

  // Helper: build registerServerReference line
  const buildRegisterLine = (varName: string, exportName: string) =>
    `registerServerReference(${varName}, ${JSON.stringify(normalizedId)}, ${JSON.stringify(exportName)})`;

  // ----------------------------------------
  // CLIENT / SSR  -> full rewrite similar to transformClientComponents
  // ----------------------------------------
  if (environment === "client" || environment === "ssr") {
    const importPath =
      environment === "client" ? "rwsdk/client" : "rwsdk/__ssr";
    let result = `import { createServerReference } from "${importPath}";\n\n`;

    for (const exp of namedExports) {
      result += `export let ${exp.name} = createServerReference(${JSON.stringify(
        normalizedId,
      )}, ${JSON.stringify(exp.name)});\n`;
    }

    if (defaultExport) {
      if (namedExports.length > 0) result += `\n`;
      result += `export default createServerReference(${JSON.stringify(normalizedId)}, "default");\n`;
    }

    return {
      code: result,
      map: createEmptySourceMap(code, normalizedId),
    };
  }

  // ----------------------------------------
  // WORKER  -> keep implementation, inject registrations
  // ----------------------------------------
  if (environment === "worker") {
    // Remove the 'use server' directive first
    let processedCode = code.replace(/^(\s*)(["'])use server\2\s*;?\s*/m, "");

    // Detect leading block comment (/* ... */) at the very top so we can keep it before imports
    let leadingComment = "";
    const leadingBlockMatch = processedCode.match(/^\s*\/\*[\s\S]*?\*\//);
    if (leadingBlockMatch && leadingBlockMatch.index === 0) {
      leadingComment = leadingBlockMatch[0] + "\n";
      processedCode = processedCode.slice(leadingComment.length);
    }

    // Handle default export transformation
    let hasTransformedDefault = false;
    processedCode = processedCode.replace(
      /export\s+default\s+(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/m,
      (match, asyncKeyword, originalName) => {
        hasTransformedDefault = true;
        const asyncStr = asyncKeyword ? "async " : "";
        return `${asyncStr}function __defaultServerFunction__(`;
      },
    );

    // Fallback for anonymous default function
    if (!hasTransformedDefault) {
      processedCode = processedCode.replace(
        /export\s+default\s+(async\s+)?function\s*\(/m,
        (match, asyncKeyword) => {
          hasTransformedDefault = true;
          const asyncStr = asyncKeyword ? "async " : "";
          return `${asyncStr}function __defaultServerFunction__(`;
        },
      );
    }

    // Build imports for re-exports so variables are in scope for registration
    const reExportImports: string[] = [];
    for (const exp of namedExports) {
      if (exp.isReExport && exp.moduleSpecifier) {
        if (exp.isDefault) {
          reExportImports.push(
            `import { default as ${exp.name} } from ${JSON.stringify(exp.moduleSpecifier)};`,
          );
        } else {
          reExportImports.push(
            `import { ${exp.name} } from ${JSON.stringify(exp.moduleSpecifier)};`,
          );
        }
      }
    }

    const importLines = [
      ...reExportImports,
      'import { registerServerReference } from "rwsdk/worker";',
    ].join("\n");

    // Build registration lines (default first if present)
    const registerLines: string[] = [];
    if (hasTransformedDefault || defaultExport) {
      registerLines.push(
        buildRegisterLine("__defaultServerFunction__", "default"),
      );
    }

    for (const exp of namedExports) {
      registerLines.push(buildRegisterLine(exp.name, exp.name));
    }

    // When we transformed default export, we need to append export statement
    let exportDefaultLine = "";
    if (hasTransformedDefault) {
      exportDefaultLine = `export default __defaultServerFunction__;\n`;
    }

    const finalCode =
      leadingComment +
      importLines +
      "\n\n" +
      processedCode.trimStart() +
      "\n" +
      exportDefaultLine +
      registerLines.join("\n") +
      "\n";

    return {
      code: finalCode,
      map: createEmptySourceMap(code, normalizedId),
    };
  }

  // Fallback (should not reach here)
  verboseLog("No transformation applied for id=%s", normalizedId);
  return;
}

export type { TransformResult };
