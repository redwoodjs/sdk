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
  projectRootDir: string,
  modulePath: string,
): string {
  // Step 0: Normalize slashes for consistency
  modulePath = normalizePathSeparators(modulePath);
  projectRootDir = normalizePathSeparators(projectRootDir);

  // Step 1: Ensure projectRootDir is absolute
  const resolvedProjectRoot = path.resolve(projectRootDir);

  // Step 2: Resolve modulePath relative to project root
  // If modulePath is absolute, we keep it; if not, resolve against root
  const resolvedModulePath = path.isAbsolute(modulePath)
    ? modulePath
    : path.resolve(resolvedProjectRoot, modulePath);

  // Step 3: Make modulePath relative to the project root
  const relativePath = path.relative(resolvedProjectRoot, resolvedModulePath);

  // Step 4: Normalize separators again and ensure leading slash
  return "/" + normalizePathSeparators(relativePath);
}
