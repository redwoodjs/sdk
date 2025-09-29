import { Lang, Lang as SgLang, parse as sgParse } from "@ast-grep/napi";
import path from "path";

// These patterns are used to match import statements in code for SSR transformations.
export const IMPORT_PATTERNS = [
  'import { $$$ } from "$MODULE"',
  "import { $$$ } from '$MODULE'",
  'import $DEFAULT from "$MODULE"',
  "import $DEFAULT from '$MODULE'",
  'import * as $NS from "$MODULE"',
  "import * as $NS from '$MODULE'",
  'import "$MODULE"',
  "import '$MODULE'",
  // Static Re-exports
  'export { $$$ } from "$MODULE"',
  "export { $$$ } from '$MODULE'",
  'export * from "$MODULE"',
  "export * from '$MODULE'",
  // Dynamic Imports
  'import("$MODULE")',
  "import('$MODULE')",
  "import(`$MODULE`)",
  // CommonJS require
  'require("$MODULE")',
  "require('$MODULE')",
  "require(`$MODULE`)",
];

// These patterns are used to match export statements for client/server component transformations
export const EXPORT_PATTERNS = [
  // Named exports
  "export const $NAME = $$$",
  "export let $NAME = $$$",
  "export var $NAME = $$$",
  "export function $NAME($$$) { $$$ }",
  "export async function $NAME($$$) { $$$ }",
  // Default exports
  "export default function $NAME($$$) { $$$ }",
  "export default function($$$) { $$$ }",
  "export default $$$",
  // Export declarations
  "export { $$$ }",
  'export { $$$ } from "$MODULE"',
  "export { $$$ } from '$MODULE'",
];

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  alias?: string;
  originalName?: string; // The original local name (for aliases)
  isReExport?: boolean;
  moduleSpecifier?: string;
}

/**
 * Finds import specifiers and their positions in the code using the provided patterns.
 * @param code The code to search for import specifiers.
 * @param lang The language parser to use (TypeScript or Tsx).
 * @param ignoredImportPatterns Array of regex patterns to ignore.
 * @param log Optional logger function for debug output.
 * @returns Array of objects with start, end, and raw import string.
 */
export function findImportSpecifiers(
  id: string,
  code: string,
  ignoredImportPatterns: RegExp[],
  log?: (...args: any[]) => void,
): Array<{ s: number; e: number; raw: string }> {
  const ext = path.extname(id).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;
  const logger = process.env.VERBOSE ? (log ?? (() => {})) : () => {};
  const results: Array<{ s: number; e: number; raw: string }> = [];
  try {
    // sgParse and lang must be provided by the consumer
    const root = sgParse(lang, code);
    for (const pattern of IMPORT_PATTERNS) {
      try {
        const matches = root.root().findAll(pattern);
        for (const match of matches) {
          const moduleCapture = match.getMatch("MODULE");
          if (moduleCapture) {
            const importPath = moduleCapture.text();
            if (importPath.startsWith("virtual:")) {
              logger(
                ":findImportSpecifiersWithPositions: Ignoring import because it starts with 'virtual:': importPath=%s",
                importPath,
              );
            } else if (importPath.includes("__rwsdknossr")) {
              logger(
                ":findImportSpecifiersWithPositions: Ignoring import because it includes '__rwsdknossr': importPath=%s",
                importPath,
              );
            } else if (
              ignoredImportPatterns.some((pattern) => pattern.test(importPath))
            ) {
              logger(
                ":findImportSpecifiersWithPositions: Ignoring import because it matches IGNORED_IMPORT_PATTERNS: importPath=%s",
                importPath,
              );
            } else {
              const { start, end } = moduleCapture.range();
              results.push({ s: start.index, e: end.index, raw: importPath });
              logger(
                ":findImportSpecifiersWithPositions: Including import specifier: importPath=%s, range=[%d, %d]",
                importPath,
                start.index,
                end.index,
              );
            }
          }
        }
      } catch (err) {
        logger(
          ":findImportSpecifiersWithPositions: Error processing pattern: %O",
          err,
        );
      }
    }
  } catch (err) {
    logger(
      ":findImportSpecifiersWithPositions: Error parsing content: %O",
      err,
    );
  }
  return results;
}

/**
 * Finds export information in the code using ast-grep patterns.
 * @param id The file identifier for language detection.
 * @param code The code to search for exports.
 * @param log Optional logger function for debug output.
 * @returns Array of export information objects.
 */
export function findExports(
  id: string,
  code: string,
  log?: (...args: any[]) => void,
): ExportInfo[] {
  const ext = path.extname(id).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;
  const logger = process.env.VERBOSE ? (log ?? (() => {})) : () => {};
  const results: ExportInfo[] = [];
  const seen = new Set<string>(); // Track seen exports to avoid duplicates

  try {
    const root = sgParse(lang, code);

    // Use the existing EXPORT_PATTERNS in a specific order to avoid duplicates
    const orderedPatterns = [
      // Handle re-exports first (most specific)
      ...EXPORT_PATTERNS.filter(
        (p) => p.includes('from "$MODULE"') || p.includes("from '$MODULE'"),
      ),
      // Then named exports
      ...EXPORT_PATTERNS.filter(
        (p) =>
          p.startsWith("export const") ||
          p.startsWith("export let") ||
          p.startsWith("export var") ||
          p.startsWith("export function") ||
          p.startsWith("export async function"),
      ),
      // Then default exports
      ...EXPORT_PATTERNS.filter((p) => p.startsWith("export default")),
      // Finally export declarations
      ...EXPORT_PATTERNS.filter((p) => p === "export { $$$ }"),
    ];

    for (const pattern of orderedPatterns) {
      try {
        const matches = root.root().findAll(pattern);
        for (const match of matches) {
          const nameCapture = match.getMatch("NAME");
          const moduleCapture = match.getMatch("MODULE");
          const matchText = match.text();

          if (
            pattern.includes('from "$MODULE"') ||
            pattern.includes("from '$MODULE'")
          ) {
            // Re-export from module
            const moduleSpecifier = moduleCapture?.text();
            if (!moduleSpecifier) continue;

            if (pattern.includes("export *")) {
              // Skip export * for now - too complex
              logger("Skipping export * from %s", moduleSpecifier);
              continue;
            }

            // Parse the export list
            const exportListMatch = matchText.match(
              /export\s*\{\s*([^}]+)\s*\}/,
            );
            if (exportListMatch) {
              const exportList = exportListMatch[1];
              const exports = exportList.split(",").map((e) => e.trim());
              for (const exp of exports) {
                const [originalName, alias] = exp.includes(" as ")
                  ? exp.split(" as ").map((s) => s.trim())
                  : [exp.trim(), undefined];

                const exportName = alias || originalName;
                const key = `${exportName}:${originalName === "default"}:reexport:${moduleSpecifier}`;
                if (seen.has(key)) continue;
                seen.add(key);

                results.push({
                  name: exportName,
                  isDefault: originalName === "default",
                  alias: alias !== originalName ? alias : undefined,
                  originalName: originalName,
                  isReExport: true,
                  moduleSpecifier,
                });
                logger(
                  "Found re-export: %s from %s",
                  exportName,
                  moduleSpecifier,
                );
              }
            }
          } else if (matchText.startsWith("export default")) {
            // Default export
            const name = nameCapture?.text() || "default";
            const key = `${name}:true:default`;
            if (seen.has(key)) continue;
            seen.add(key);

            results.push({
              name,
              isDefault: true,
            });
            logger("Found default export: %s", name);
          } else if (
            matchText.includes("export {") &&
            !match.getMatch("MODULE")
          ) {
            // Local export declaration
            const exportListMatch = matchText.match(
              /export\s*\{\s*([^}]+)\s*\}/,
            );
            if (exportListMatch) {
              const exportList = exportListMatch[1];
              const exports = exportList.split(",").map((e) => e.trim());
              for (const exp of exports) {
                const [originalName, alias] = exp.includes(" as ")
                  ? exp.split(" as ").map((s) => s.trim())
                  : [exp.trim(), undefined];

                const exportName = alias || originalName;
                const key = `${exportName}:${originalName === "default"}:local`;
                if (seen.has(key)) continue;
                seen.add(key);

                results.push({
                  name: exportName,
                  isDefault: originalName === "default",
                  alias: alias !== originalName ? alias : undefined,
                  originalName: originalName,
                });
                logger("Found local export: %s", exportName);
              }
            }
          } else if (nameCapture) {
            // Named export (function, const, etc.)
            const name = nameCapture.text();
            const key = `${name}:false:named`;
            if (seen.has(key)) continue;
            seen.add(key);

            results.push({
              name,
              isDefault: false,
            });
            logger("Found named export: %s", name);
          }
        }
      } catch (err) {
        logger("Error processing export pattern %s: %O", pattern, err);
      }
    }
  } catch (err) {
    logger("Error parsing code for exports: %O", err);
  }

  return results;
}
