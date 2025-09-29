import debug from "debug";
import MagicString from "magic-string";
import { findExports } from "./findSpecifiers.mjs";
import { hasDirective } from "./hasDirective.mjs";

interface TransformContext {
  environmentName: string;
  clientFiles?: Set<string>;
  isEsbuild?: boolean;
}

interface TransformResult {
  code: string;
  map?: any;
}

const logVite = debug("rwsdk:vite:transform-client-components:vite");
const logEsbuild = debug("rwsdk:vite:transform-client-components:esbuild");

export async function transformClientComponents(
  code: string,
  normalizedId: string,
  ctx: TransformContext,
): Promise<TransformResult | undefined> {
  if (
    !ctx.clientFiles?.has(normalizedId) &&
    !hasDirective(code, "use client")
  ) {
    return;
  }

  const log = ctx.isEsbuild ? logEsbuild : logVite;

  // Parse exports using the findExports helper
  const exportInfos = findExports(normalizedId, code, log);

  // Process exports into the format expected by the rst of the function
  type ProcessedExportInfo = {
    local: string;
    exported: string;
    isDefault: boolean;
    statementIdx: number;
    alias?: string;
  };

  const processedExports: ProcessedExportInfo[] = [];
  let defaultExportInfo: ProcessedExportInfo | undefined;

  // Helper to get the computed local name (with alias suffix if present)
  function getComputedLocalName(info: ProcessedExportInfo): string {
    return `${info.local}${info.alias ? `_${info.alias}` : ""}`;
  }

  // Convert ExportInfo to ProcessedExportInfo
  exportInfos.forEach((exportInfo, idx) => {
    if (exportInfo.isDefault) {
      defaultExportInfo = {
        local: exportInfo.alias || "default",
        exported: "default",
        isDefault: true,
        statementIdx: idx,
      };
    } else {
      // For aliases like "export { MyComponent as CustomName }", we need:
      // - local: "MyComponent" (the original name)
      // - exported: "CustomName" (the alias name)
      // - alias: "CustomName" (to generate MyComponent_CustomName)
      if (!exportInfo.name) {
        return;
      }
      const hasAlias = exportInfo.alias && exportInfo.originalName;
      processedExports.push({
        local: exportInfo.originalName || exportInfo.name, // Use originalName if available
        exported: exportInfo.name, // The exported name (alias if present)
        isDefault: false,
        statementIdx: idx,
        alias: hasAlias ? exportInfo.alias : undefined,
      });
    }
  });

  // 3. Client/SSR files: just remove the directive
  if (ctx.environmentName === "ssr" || ctx.environmentName === "client") {
    log(
      ":isEsbuild=%s: Handling SSR virtual module: %s",
      !!ctx.isEsbuild,
      normalizedId,
    );

    // Remove 'use client' directive using magic-string
    const s = new MagicString(code);

    // Find and remove "use client" directives
    const directiveRegex = /^(\s*)(['"]use client['"])\s*;?\s*\n?/gm;
    let match;
    while ((match = directiveRegex.exec(code)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      s.remove(start, end);
      process.env.VERBOSE &&
        log(
          "Removed 'use client' directive from normalizedId=%s",
          normalizedId,
        );
      break; // Only remove the first one
    }

    const sourceMap = s.generateMap({
      source: normalizedId,
      includeContent: true,
      hires: true,
    });

    process.env.VERBOSE &&
      log(
        ":VERBOSE: SSR transformed code for %s:\n%s",
        normalizedId,
        s.toString(),
      );

    return {
      code: s.toString(),
      map: sourceMap,
    };
  }

  // 4. Non-SSR files: replace all implementation with registerClientReference logic
  // Generate completely new code for worker/client environments
  const s = new MagicString("");

  s.append('import { ssrLoadModule } from "rwsdk/__ssr_bridge";\n');
  s.append('import { registerClientReference } from "rwsdk/worker";\n');
  s.append(`const SSRModule = await ssrLoadModule("${normalizedId}");\n`);

  // Compute unique computed local names first
  const computedLocalNames = new Map(
    processedExports.map((info) => [getComputedLocalName(info), info]),
  );

  // Add registerClientReference assignments for unique names
  for (const [computedLocalName, correspondingInfo] of computedLocalNames) {
    s.append(
      `const ${computedLocalName} = registerClientReference(SSRModule, "${normalizedId}", "${correspondingInfo.exported}");\n`,
    );
  }

  // Add grouped export statement for named exports (preserving order and alias)
  if (processedExports.length > 0) {
    const exportNames = Array.from(computedLocalNames.entries()).map(
      ([computedLocalName, correspondingInfo]) =>
        correspondingInfo.local === correspondingInfo.exported
          ? computedLocalName
          : `${computedLocalName} as ${correspondingInfo.exported}`,
    );
    s.append(`export { ${exportNames.join(", ")} };\n`);
  }

  // Add default export if present
  if (defaultExportInfo) {
    log(
      ":isEsbuild=%s: Registering client reference for default export: %s",
      !!ctx.isEsbuild,
      defaultExportInfo.exported,
    );
    s.append(
      `export default registerClientReference(SSRModule, "${normalizedId}", "${defaultExportInfo.exported}");\n`,
    );
  }

  const sourceMap = s.generateMap({
    source: normalizedId,
    includeContent: true,
    hires: true,
  });

  const finalResult = s.toString();

  process.env.VERBOSE &&
    log(
      ":VERBOSE: Transformed code (env=%s, normalizedId=%s):\n%s",
      normalizedId,
      ctx.environmentName,
      finalResult,
    );

  return {
    code: finalResult,
    map: sourceMap,
  };
}

export type { TransformContext, TransformResult };
