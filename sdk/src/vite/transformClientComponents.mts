import MagicString from "magic-string";
import debug from "debug";
import { hasDirective } from "./hasDirective.mjs";
import { findExports, type ExportInfo } from "./findImportSpecifiers.mjs";
import { invalidateModule } from "./invalidateModule.mjs";
import type { ViteDevServer } from "vite";

interface TransformContext {
  environmentName: string;
  clientFiles?: Set<string>;
  isEsbuild?: boolean;
  devServer?: ViteDevServer;
}

interface TransformResult {
  code: string;
  map?: any;
}

const logVite = debug("rwsdk:vite:transform-client-components:vite");
const logEsbuild = debug("rwsdk:vite:transform-client-components:esbuild");
const verboseLogVite = debug(
  "verbose:rwsdk:vite:transform-client-components:vite",
);
const verboseLogEsbuild = debug(
  "verbose:rwsdk:vite:transform-client-components:esbuild",
);

export async function transformClientComponents(
  code: string,
  normalizedId: string,
  ctx: TransformContext,
): Promise<TransformResult | undefined> {
  const log = ctx.isEsbuild ? logEsbuild : logVite;
  const verboseLog = ctx.isEsbuild ? verboseLogEsbuild : verboseLogVite;
  log(
    "Called transformClientComponents for id: id=%s, ctx: %O",
    normalizedId,
    ctx,
  );

  if (!hasDirective(code, "use client")) {
    log("Skipping: no 'use client' directive in id=%s", normalizedId);
    verboseLog(
      ":VERBOSE: Returning code unchanged for id=%s:\n%s",
      normalizedId,
      code,
    );
    return;
  }

  log("Processing 'use client' module: id=%s", normalizedId);

  ctx.clientFiles?.add(normalizedId);

  // Invalidate the lookup module when a client file is added
  if (ctx.devServer && !ctx.isEsbuild) {
    try {
      invalidateModule(
        ctx.devServer,
        ctx.environmentName,
        "virtual:use-client-lookup",
        log,
        verboseLog,
      );
      log(
        "Invalidated use-client-lookup module for environment: %s",
        ctx.environmentName,
      );
    } catch (error) {
      verboseLog("Failed to invalidate use-client-lookup module: %O", error);
    }
  }

  // For SSR/Client environments: just remove the directive
  if (ctx.environmentName === "ssr" || ctx.environmentName === "client") {
    log(
      ":isEsbuild=%s: Handling SSR/Client environment: %s",
      !!ctx.isEsbuild,
      normalizedId,
    );

    const s = new MagicString(code);

    // Find and remove 'use client' directive
    const useClientMatch = code.match(/^(\s*)(["'])use client\2\s*;?\s*/m);
    if (useClientMatch) {
      const start = code.indexOf(useClientMatch[0]);
      const end = start + useClientMatch[0].length;
      s.remove(start, end);
      log("Removed 'use client' directive from %s", normalizedId);
    }

    const result = {
      code: s.toString(),
      map: s.generateMap({ hires: true }),
    };

    verboseLog(
      ":VERBOSE: SSR transformed code for %s:\n%s",
      normalizedId,
      result.code,
    );

    return result;
  }

  // For Worker environment: complete rewrite using template
  log("Handling Worker environment: %s", normalizedId);

  // Extract exports using ast-grep (much faster than ts-morph)
  const exports = findExports(normalizedId, code, log);

  // Filter out duplicates and organize
  const namedExports: ExportInfo[] = [];
  let defaultExport: ExportInfo | undefined;
  const seen = new Set<string>();

  for (const exp of exports) {
    if (exp.isReExport) continue; // Skip re-exports for now

    const key = `${exp.name}:${exp.isDefault}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (exp.isDefault) {
      if (!defaultExport) {
        defaultExport = exp;
      }
    } else {
      namedExports.push(exp);
    }
  }

  log(
    ":isEsbuild=%s: Found %d named exports, %s default export",
    !!ctx.isEsbuild,
    namedExports.length,
    defaultExport ? "1" : "no",
  );

  // Generate the transformed code using template strings (much faster than ts-morph)
  let result = `import { registerClientReference } from "rwsdk/worker";\n`;

  // Add registerClientReference assignments for named exports
  for (const exp of namedExports) {
    // For aliases, create a computed name using name_alias
    // e.g., export { MyComponent as CustomName } -> const MyComponent_CustomName = ...
    const computedName = exp.alias ? `${exp.name}_${exp.alias}` : exp.name;
    result += `const ${computedName} = registerClientReference("${normalizedId}", "${exp.name}");\n`;
    log(
      ":isEsbuild=%s: Registering client reference for named export: %s",
      !!ctx.isEsbuild,
      exp.name,
    );
  }

  // Add grouped export statement for named exports
  if (namedExports.length > 0) {
    const exportNames = namedExports.map((exp) => {
      const computedName = exp.alias ? `${exp.name}_${exp.alias}` : exp.name;
      return exp.alias ? `${computedName} as ${exp.name}` : computedName;
    });
    result += `export { ${exportNames.join(", ")} };\n`;
    log(
      ":isEsbuild=%s: Exporting named exports: %O",
      !!ctx.isEsbuild,
      exportNames,
    );
  }

  // Add default export if present
  if (defaultExport) {
    result += `export default registerClientReference("${normalizedId}", "default");\n`;
    log(
      ":isEsbuild=%s: Registering client reference for default export",
      !!ctx.isEsbuild,
    );
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
    ctx.environmentName,
    normalizedId,
    finalResult.code,
  );

  return finalResult;
}

export type { TransformContext, TransformResult };
