import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "vite";

import { ENV_RESOLVERS, maybeResolveEnvImport } from "./envResolvers.mjs";

const BARE_SPECIFIER_RE = /^(?:@[^/]+\/)?[^/]+/;

type EnvName = keyof typeof ENV_RESOLVERS;

function normalizePathSeparators(p: string) {
  return normalizePath(p.replace(/\\/g, "/"));
}

function getResolverForEnv(envName: string): EnvName {
  return envName in ENV_RESOLVERS ? (envName as EnvName) : "client";
}

function resolveExcludeRoot(
  entry: string,
  projectRootDir: string,
  envName: EnvName,
): string | undefined {
  projectRootDir = normalizePathSeparators(path.resolve(projectRootDir));
  entry = normalizePathSeparators(entry);

  // Absolute filesystem path: keep it but resolve symlinks.
  if (path.isAbsolute(entry)) {
    try {
      return normalizePathSeparators(fs.realpathSync(entry));
    } catch {
      return entry;
    }
  }

  // Relative path: resolve from the project root.
  if (entry.startsWith("./") || entry.startsWith("../")) {
    const resolved = normalizePathSeparators(
      path.resolve(projectRootDir, entry),
    );
    try {
      return normalizePathSeparators(fs.realpathSync(resolved));
    } catch {
      return resolved;
    }
  }

  // Bare specifier (package, scoped package, or package subpath).
  const match = entry.match(BARE_SPECIFIER_RE);
  if (match) {
    const pkg = match[0];
    const subpath = entry.slice(pkg.length);

    const pkgJsonPath = maybeResolveEnvImport({
      id: `${pkg}/package.json`,
      envName,
      projectRootDir,
    });

    if (!pkgJsonPath) {
      return undefined;
    }

    const pkgRoot = normalizePathSeparators(path.dirname(pkgJsonPath));
    const resolvedRoot = subpath
      ? normalizePathSeparators(path.join(pkgRoot, subpath))
      : pkgRoot;

    try {
      return normalizePathSeparators(fs.realpathSync(resolvedRoot));
    } catch {
      return resolvedRoot;
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
 * environment config into a single, deduplicated list.
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
 * Collect `optimizeDeps.exclude` patterns grouped by Vite environment.
 *
 * Root-level excludes apply to every environment. Per-environment excludes
 * apply only to that environment. When no environments are configured (e.g.
 * Vite 7), the known RedwoodSDK environments (`client`, `ssr`, `worker`) are
 * populated with the root-level patterns.
 */
export function getOptimizeDepsExcludePatternsByEnv(
  config: OptimizeDepsConfig,
): Record<string, string[]> {
  const rootPatterns = config.optimizeDeps?.exclude ?? [];
  const environments = config.environments ?? {};
  const patternsByEnv: Record<string, string[]> = {};

  for (const envName of Object.keys(environments)) {
    patternsByEnv[envName] = [...rootPatterns];
  }

  // Fallback for non-environmental configs.
  if (Object.keys(patternsByEnv).length === 0) {
    for (const envName of Object.keys(ENV_RESOLVERS)) {
      patternsByEnv[envName] = [...rootPatterns];
    }
  }

  for (const [envName, env] of Object.entries(environments)) {
    for (const entry of env?.optimizeDeps?.exclude ?? []) {
      if (entry) {
        patternsByEnv[envName].push(entry);
      }
    }
  }

  return patternsByEnv;
}

function resolveOptimizeDepsExcludesForEnv(
  excludes: string[],
  projectRootDir: string,
  envName: EnvName,
): string[] {
  const roots = new Set<string>();

  for (const entry of excludes) {
    if (!entry) {
      continue;
    }

    const root = resolveExcludeRoot(entry, projectRootDir, envName);
    if (root) {
      roots.add(root);
      continue;
    }

    // If the environment resolver couldn't locate the package, fall back to a
    // node_modules path so the exclusion still has a chance to match.
    const match = entry.match(BARE_SPECIFIER_RE);
    if (match) {
      roots.add(
        normalizePathSeparators(
          path.join(projectRootDir, "node_modules", entry),
        ),
      );
    }
  }

  return [...roots];
}

/**
 * Resolve per-environment `optimizeDeps.exclude` patterns into absolute
 * filesystem roots. Each environment is resolved with the environment-aware
 * resolver that matches its execution context.
 */
export function resolveOptimizeDepsExcludesByEnv(
  patternsByEnv: Record<string, string[]>,
  projectRootDir: string,
): Record<string, string[]> {
  const rootsByEnv: Record<string, string[]> = {};

  for (const [envName, patterns] of Object.entries(patternsByEnv)) {
    rootsByEnv[envName] = resolveOptimizeDepsExcludesForEnv(
      patterns,
      projectRootDir,
      getResolverForEnv(envName),
    );
  }

  return rootsByEnv;
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
 *
 * Each pattern is resolved through RedwoodSDK's environment-aware resolvers so
 * that packages with environment-specific exports are located correctly for the
 * client, SSR, and worker environments. The resolved roots from all
 * environments are unioned together.
 */
export function resolveOptimizeDepsExcludes(
  excludes: string[],
  projectRootDir: string,
): string[] {
  const envNames = Object.keys(ENV_RESOLVERS) as EnvName[];
  const roots = new Set<string>();

  for (const envName of envNames) {
    for (const root of resolveOptimizeDepsExcludesForEnv(
      excludes,
      projectRootDir,
      envName,
    )) {
      roots.add(root);
    }
  }

  return [...roots];
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
