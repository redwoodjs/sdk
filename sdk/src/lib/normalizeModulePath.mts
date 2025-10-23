import * as path from "node:path";
import { normalizePath as normalizePathSeparators } from "vite";

/**
 * Find the number of common ancestor segments between two absolute paths.
 * Returns the count of shared directory segments from the root.
 */
export function findCommonAncestorDepth(path1: string, path2: string): number {
  const segments1 = path1.split("/").filter(Boolean);
  const segments2 = path2.split("/").filter(Boolean);

  let commonLength = 0;
  const minLength = Math.min(segments1.length, segments2.length);

  for (let i = 0; i < minLength; i++) {
    if (segments1[i] === segments2[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  return commonLength;
}

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
 *
 * With { isViteStyle: false }:
 *   /opt/tools/logger.ts                  → /opt/tools/logger.ts (treated as external)
 *   /src/page.tsx                         → /src/page.tsx (treated as external)
 *
 * With { isViteStyle: true }:
 *   /opt/tools/logger.ts                  → /opt/tools/logger.ts (resolved as Vite-style)
 *   /src/page.tsx, { absolute: true }     → /Users/justin/my-app/src/page.tsx
 */
export function normalizeModulePath(
  modulePath: string,
  projectRootDir: string,
  options: { absolute?: boolean; isViteStyle?: boolean } = {},
): string {
  console.log(`[normalizeModulePath] IN:`, {
    modulePath,
    projectRootDir,
    options,
  });
  console.trace(`[normalizeModulePath] Call stack`);

  modulePath = normalizePathSeparators(modulePath);
  projectRootDir = normalizePathSeparators(path.resolve(projectRootDir));

  // Handle empty string or current directory
  if (modulePath === "" || modulePath === ".") {
    return options.absolute ? projectRootDir : "/";
  }

  // For relative paths, resolve them first
  let resolved: string;
  if (path.isAbsolute(modulePath)) {
    if (
      modulePath.startsWith(projectRootDir + "/") ||
      modulePath === projectRootDir
    ) {
      // Path starts with project root - it's a real absolute path inside project
      resolved = modulePath;
    } else {
      // Check how the path relates to the project root
      if (options.isViteStyle !== undefined) {
        // User explicitly specified whether this should be treated as Vite-style
        if (options.isViteStyle) {
          resolved = path.resolve(projectRootDir, modulePath.slice(1));
        } else {
          resolved = modulePath;
        }
      } else {
        // Fall back to heuristics using common ancestor depth
        const commonDepth = findCommonAncestorDepth(modulePath, projectRootDir);

        if (commonDepth > 0) {
          // Paths share meaningful common ancestor - treat as real absolute path
          resolved = modulePath;
        } else {
          // No meaningful common ancestor - assume Vite-style path within project
          resolved = path.resolve(projectRootDir, modulePath.slice(1));
        }
      }
    }
  } else {
    resolved = path.resolve(projectRootDir, modulePath);
  }

  resolved = normalizePathSeparators(resolved);

  // If absolute option is set, always return absolute paths
  if (options.absolute) {
    return resolved;
  }

  // Check if the resolved path is within the project root
  const relative = path.relative(projectRootDir, resolved);

  // If the path goes outside the project root (starts with ..), return absolute
  if (relative.startsWith("..")) {
    return resolved;
  }

  // Path is within project root, return as Vite-style relative path
  const cleanRelative = relative === "." ? "" : relative;
  const finalPath = "/" + normalizePathSeparators(cleanRelative);
  console.log(`[normalizeModulePath] OUT:`, { finalPath });
  return finalPath;
}
