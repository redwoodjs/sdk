import * as path from "node:path";
import { normalizePath as normalizePathSeparators } from "vite";

/**
 * Normalize a module path to a consistent, project-root-relative form.
 * Always returns a slash-prefixed path.
 *
 * Examples:
 *   /Users/justin/my-app/src/page.ts      → /src/page.ts
 *   ../shared/utils.ts                    → /../shared/utils.ts
 *   /src/page.ts (Vite-style)            → /src/page.ts
 *   node_modules/foo/index.js            → /node_modules/foo/index.js
 *   /Users/justin/other/foo.ts           → /../justin/other/foo.ts
 */
export function normalizeModulePath(
  modulePath: string,
  projectRootDir: string,
): string {
  modulePath = normalizePathSeparators(modulePath);
  projectRootDir = normalizePathSeparators(path.resolve(projectRootDir));

  // Vite-style paths like `/src/foo.ts` (not actual absolute system paths)
  const looksLikeViteStyle =
    modulePath.startsWith("/") && !modulePath.startsWith(projectRootDir);

  const resolved = looksLikeViteStyle
    ? path.resolve(projectRootDir, modulePath.slice(1))
    : path.resolve(projectRootDir, modulePath);

  const relative = path.relative(projectRootDir, resolved);

  return "/" + normalizePathSeparators(relative);
}
