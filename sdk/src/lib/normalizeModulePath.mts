import * as path from "node:path";
import { normalizePath as normalizePathSeparators } from "vite";

/**
 * Normalize a module path to a consistent form.
 * Returns slash-prefixed paths for files within project root,
 * or absolute paths for external files.
 *
 * Examples:
 *   /Users/justin/my-app/src/page.ts      → /src/page.ts
 *   ../shared/utils.ts                    → /Users/justin/shared/utils.ts
 *   /src/page.ts (Vite-style)            → /src/page.ts
 *   node_modules/foo/index.js            → /node_modules/foo/index.js
 *
 * With { absolute: true }:
 *   /Users/justin/my-app/src/page.ts      → /Users/justin/my-app/src/page.ts
 */
export function normalizeModulePath(
  modulePath: string,
  projectRootDir: string,
  options: { absolute?: boolean } = {},
): string {
  modulePath = normalizePathSeparators(modulePath);
  projectRootDir = normalizePathSeparators(path.resolve(projectRootDir));

  // Handle empty string or current directory
  if (modulePath === "" || modulePath === ".") {
    return options.absolute ? projectRootDir : "/";
  }

  // Check if it's a real absolute filesystem path
  // Real absolute paths: start with project root OR look like system paths (/Users, /opt, /home, /etc, etc.)
  const isRealAbsolutePath =
    modulePath.startsWith("/") &&
    (modulePath.startsWith(projectRootDir) || // Starts with project root
      modulePath.match(
        /^\/(?:Users|home|opt|etc|var|tmp|usr|bin|sbin|lib|mnt|media|proc|sys|dev|root)\//,
      )); // Known system paths

  // Vite-style paths like `/src/foo.ts`, `/node_modules/foo.js`
  // These start with / but are meant to be project-relative
  const isViteStylePath = modulePath.startsWith("/") && !isRealAbsolutePath;

  let resolved: string;

  if (isRealAbsolutePath) {
    // Already an absolute path, use as-is
    resolved = modulePath;
  } else if (isViteStylePath) {
    // Vite-style path: resolve relative to project root
    resolved = path.resolve(projectRootDir, modulePath.slice(1));
  } else {
    // Relative path: resolve relative to project root
    resolved = path.resolve(projectRootDir, modulePath);
  }

  const normalizedResolved = normalizePathSeparators(resolved);

  // If absolute option is set, always return absolute paths
  if (options.absolute) {
    return normalizedResolved;
  }

  const relative = path.relative(projectRootDir, resolved);

  // If the path goes outside the project root (starts with ..), return absolute
  if (relative.startsWith("..")) {
    return normalizedResolved;
  }

  // Clean up current directory references
  const cleanRelative = relative === "." ? "" : relative;

  return "/" + normalizePathSeparators(cleanRelative);
}
