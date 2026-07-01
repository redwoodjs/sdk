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

type OptimizeDepsConfig = {
  optimizeDeps?: { exclude?: string[] };
  environments?: Record<string, { optimizeDeps?: { exclude?: string[] } }>;
};

/**
 * Collect `optimizeDeps.exclude` patterns from the root config and from every
 * environment config. Vite 8 allows per-environment `optimizeDeps`, so a user
 * may exclude a package globally or only for a specific environment. RedwoodSDK
 * needs the union so that directive files from any excluded package are moved
 * into the app barrel.
 */
export function getOptimizeDepsExcludePatterns(
  config: OptimizeDepsConfig,
): string[] {
  const patterns = new Set<string>();

  for (const entry of config.optimizeDeps?.exclude ?? []) {
    if (entry) {
      patterns.add(entry);
    }
  }

  for (const env of Object.values(config.environments ?? {})) {
    for (const entry of env?.optimizeDeps?.exclude ?? []) {
      if (entry) {
        patterns.add(entry);
      }
    }
  }

  return [...patterns];
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
  const normalizedFile = normalizePathSeparators(file);
  const candidates = new Set<string>();
  candidates.add(normalizedFile);

  if (projectRootDir) {
    const root = normalizePathSeparators(path.resolve(projectRootDir));

    // If the file isn't already an absolute path inside the project root, also
    // try resolving it from the project root. This covers both relative paths
    // and Vite-style project-relative paths such as `/node_modules/foo/index.js`,
    // which is how files inside the project root are represented after
    // `normalizeModulePath`. We keep the original candidate too so external
    // absolute paths (e.g. symlinked monorepo packages) still match their own
    // excluded roots even if resolving from the project root produces a bogus
    // path.
    if (normalizedFile !== root && !normalizedFile.startsWith(root + "/")) {
      const relativePart = normalizedFile.startsWith("/")
        ? normalizedFile.slice(1)
        : normalizedFile;
      candidates.add(normalizePathSeparators(path.resolve(root, relativePart)));
    }
  }

  return excludedRoots.some((excludedRoot) => {
    const normalizedExcludedRoot = normalizePathSeparators(excludedRoot);
    const prefix = normalizedExcludedRoot.endsWith("/")
      ? normalizedExcludedRoot
      : normalizedExcludedRoot + "/";

    return Array.from(candidates).some(
      (candidate) =>
        candidate === normalizedExcludedRoot || candidate.startsWith(prefix),
    );
  });
}
