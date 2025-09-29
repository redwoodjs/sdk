import { Lang, Lang as SgLang, parse as sgParse } from "@ast-grep/napi";
import path from "path";

/**
 * Finds callsites for __vite_ssr_import__ and __vite_ssr_dynamic_import__ with their ranges.
 * The returned ranges can be used with MagicString to overwrite the entire call expression.
 */
export function findSsrImportCallSites(
  id: string,
  code: string,
  log?: (...args: any[]) => void,
): Array<{
  start: number;
  end: number;
  specifier: string;
  kind: "import" | "dynamic_import";
}> {
  const ext = path.extname(id).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;
  const logger = process.env.VERBOSE ? (log ?? (() => {})) : () => {};
  const results: Array<{
    start: number;
    end: number;
    specifier: string;
    kind: "import" | "dynamic_import";
  }> = [];

  try {
    const root = sgParse(lang, code);
    const patterns = [
      {
        pattern: `__vite_ssr_import__("$SPECIFIER")`,
        kind: "import" as const,
      },
      {
        pattern: `__vite_ssr_import__('$SPECIFIER')`,
        kind: "import" as const,
      },
      {
        pattern: `__vite_ssr_dynamic_import__("$SPECIFIER")`,
        kind: "dynamic_import" as const,
      },
      {
        pattern: `__vite_ssr_dynamic_import__('$SPECIFIER')`,
        kind: "dynamic_import" as const,
      },
      {
        pattern: `__vite_ssr_import__("$SPECIFIER", $$$REST)`,
        kind: "import" as const,
      },
      {
        pattern: `__vite_ssr_import__('$SPECIFIER', $$$REST)`,
        kind: "import" as const,
      },
      {
        pattern: `__vite_ssr_dynamic_import__("$SPECIFIER", $$$REST)`,
        kind: "dynamic_import" as const,
      },
      {
        pattern: `__vite_ssr_dynamic_import__('$SPECIFIER', $$$REST)`,
        kind: "dynamic_import" as const,
      },
    ];

    for (const { pattern, kind } of patterns) {
      const matches = root.root().findAll(pattern);
      for (const match of matches) {
        const specifier = match.getMatch("SPECIFIER")?.text();
        if (specifier) {
          const range = match.range();
          results.push({
            start: range.start.index,
            end: range.end.index,
            specifier,
            kind,
          });
          logger(
            `Found SSR import callsite: %s [%s] at %d-%d`,
            specifier,
            kind,
            range.start.index,
            range.end.index,
          );
        }
      }
    }
  } catch (err) {
    logger("Error parsing code for SSR import callsites: %O", err);
  }

  return results;
}
