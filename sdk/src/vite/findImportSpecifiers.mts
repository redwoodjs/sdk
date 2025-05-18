import { parse as sgParse, Lang as SgLang, Lang } from "@ast-grep/napi";
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
  const logger = log ?? (() => {});
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
