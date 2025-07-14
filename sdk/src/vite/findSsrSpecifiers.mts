import { parse as sgParse, Lang as SgLang, Lang } from "@ast-grep/napi";
import path from "path";

/**
 * Finds __vite_ssr_import__ and __vite_ssr_dynamic_import__ specifiers in the code.
 * @param id The file identifier for language detection.
 * @param code The code to search for SSR imports.
 * @param log Optional logger function for debug output.
 * @returns Object with arrays of static and dynamic import specifiers.
 */
export function findSsrImportSpecifiers(
  id: string,
  code: string,
  log?: (...args: any[]) => void,
): { imports: string[]; dynamicImports: string[] } {
  const ext = path.extname(id).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;
  const logger = process.env.VERBOSE ? (log ?? (() => {})) : () => {};
  const imports: string[] = [];
  const dynamicImports: string[] = [];

  try {
    const root = sgParse(lang, code);
    const patterns = [
      {
        pattern: `__vite_ssr_import__("$SPECIFIER")`,
        list: imports,
      },
      {
        pattern: `__vite_ssr_import__('$SPECIFIER')`,
        list: imports,
      },
      {
        pattern: `__vite_ssr_dynamic_import__("$SPECIFIER")`,
        list: dynamicImports,
      },
      {
        pattern: `__vite_ssr_dynamic_import__('$SPECIFIER')`,
        list: dynamicImports,
      },
    ];

    for (const { pattern, list } of patterns) {
      const matches = root.root().findAll(pattern);
      for (const match of matches) {
        const specifier = match.getMatch("SPECIFIER")?.text();
        if (specifier) {
          list.push(specifier);
          logger(
            `Found SSR import specifier: %s in pattern: %s`,
            specifier,
            pattern,
          );
        }
      }
    }
  } catch (err) {
    logger("Error parsing code for SSR imports: %O", err);
  }

  return { imports, dynamicImports };
}
