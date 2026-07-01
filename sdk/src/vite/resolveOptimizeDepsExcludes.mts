import fsp from "node:fs/promises";
import path from "node:path";
import { normalizePath } from "vite";

const BARE_SPECIFIER_RE = /^(?:@[^/]+\/)?[^/]+/;

function normalizePathSeparators(p: string) {
  return normalizePath(p.replace(/\\/g, "/"));
}

async function resolveExcludeRoot(
  entry: string,
  projectRootDir: string,
  require: NodeRequire,
): Promise<string> {
  projectRootDir = normalizePathSeparators(path.resolve(projectRootDir));
  entry = normalizePathSeparators(entry);

  // Absolute filesystem path: keep it but resolve symlinks.
  if (path.isAbsolute(entry)) {
    try {
      return normalizePathSeparators(await fsp.realpath(entry));
    } catch {
      return entry;
    }
  }

  // Relative path: resolve from the project root.
  if (entry.startsWith("./") || entry.startsWith("../")) {
    return normalizePathSeparators(path.resolve(projectRootDir, entry));
  }

  // Bare specifier (package, scoped package, or package subpath).
  const match = entry.match(BARE_SPECIFIER_RE);
  if (match) {
    const pkg = match[0];
    const subpath = entry.slice(pkg.length);

    try {
      const pkgJsonPath = require.resolve(`${pkg}/package.json`);
      const pkgRoot = normalizePathSeparators(path.dirname(pkgJsonPath));
      return subpath
        ? normalizePathSeparators(path.join(pkgRoot, subpath))
        : pkgRoot;
    } catch {
      // Package can't be resolved (e.g. a glob or a typo): fall back to a
      // node_modules path so the exclusion still has a chance to match.
      return normalizePathSeparators(
        path.join(projectRootDir, "node_modules", entry),
      );
    }
  }

  // Anything else is treated as root-relative.
  return normalizePathSeparators(path.join(projectRootDir, entry));
}

/**
 * Resolve entries from Vite's `optimizeDeps.exclude` into absolute filesystem
 * roots that can be matched against discovered directive files.
 *
 * Supports:
 * - Bare package names (`my-ui-lib`)
 * - Scoped packages (`@scope/pkg`)
 * - Package subpaths (`my-ui-lib/components`)
 * - Relative paths (`./packages/my-ui-lib`)
 * - Absolute paths
 *
 * Symlinked packages (e.g. `file:./packages/my-ui-lib`) are resolved to their
 * real location on disk, so source files are matched even though the import
 * specifier goes through `node_modules`.
 */
export async function resolveOptimizeDepsExcludes(
  excludes: string[],
  projectRootDir: string,
): Promise<string[]> {
  const { createRequire } = await import("node:module");
  const require = createRequire(path.join(projectRootDir, "package.json"));

  const roots: string[] = [];

  for (const entry of excludes) {
    if (!entry) {
      continue;
    }

    const root = await resolveExcludeRoot(entry, projectRootDir, require);
    if (root) {
      roots.push(root);
    }
  }

  return roots;
}

export function isExcludedFromOptimization(
  file: string,
  excludedRoots: string[],
  projectRootDir?: string,
): boolean {
  const normalizedFile = normalizePathSeparators(
    projectRootDir && !path.isAbsolute(file)
      ? path.resolve(projectRootDir, file)
      : file,
  );

  return excludedRoots.some((root) => {
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    return normalizedFile === root || normalizedFile.startsWith(prefix);
  });
}
