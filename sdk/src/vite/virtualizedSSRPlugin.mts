/**
 * context(justinvdm, 2025-05-14):
 *
 * ## Problem
 * React Server Components (RSC) and traditional SSR require different module
 * resolution:
 * - RSC modules must resolve with the "react-server" export condition
 * - SSR modules must resolve without it
 *
 * This presents a challenge for our framework, where the same modules often
 * need to run in both modes — within a single Cloudflare Worker runtime. We
 * can't split execution contexts or afford duplicated builds.
 *
 * Vite provides an elegant way to manage distinct resolution graphs via its
 * `environments` feature (`client`, `ssr`, `worker`, etc.). Each environment
 * can use different export conditions, plugins, and optimizeDeps configs.
 *
 * However, using separate environments implies separate output bundles. In our
 * case, that would nearly double the final bundle size — which is not viable
 * given Cloudflare Workers' strict 3MB limit.
 *
 * ## Solution
 * We run both RSC and SSR from a single Vite `worker` environment. To simulate
 * distinct resolution graphs, we virtualize SSR imports using a prefix.
 *
 * How it works:
 * - Any module beginning with "use client" is treated as the root of a client-boundary graph.
 * - In `transform()`, we parse and rewrite its import specifiers:
 *   - If it's a bare import and appears in our resolved dependency map (`resolvePackageDeps()`),
 *     we rewrite it to a virtual ID (e.g. `virtual:rwsdk:ssr:react`).
 *   - If it's a relative/userland import, we resolve it and rewrite it under the same virtual prefix.
 * - In `resolveId()`, we ensure that all imports *from* virtual modules remain in the same namespace,
 * - In `load()`, we read the file from disk ourselves. They'll reach
 *   transform(), but as a separate SSR module now rather than reusing what may
 *   already have been seen for this module outside of the SSR namespace.
 *
 * This allows the client-only subgraph to resolve without the "react-server" condition, within a single
 * Cloudflare Worker bundle, without a custom module graph or duplicated builds.
 */

import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";
import enhancedResolve from "enhanced-resolve";
import MagicString from "magic-string";
import debug from "debug";
import { glob } from "glob";
import { parse as sgParse, Lang as SgLang } from "@ast-grep/napi";
import { ROOT_DIR } from "../lib/constants.mjs";

export const SSR_BASE_NAMESPACE = "virtual:rwsdk:ssr:";
export const SSR_MODULE_NAMESPACE = SSR_BASE_NAMESPACE + "module:";
export const SSR_DEP_NAMESPACE = SSR_BASE_NAMESPACE + "dep:";

const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");
const logScan = log.extend("scan");
const logWatch = log.extend("watch");

// Esbuild-specific loggers
const logEsbuild = debug("rwsdk:vite:virtualized-ssr:esbuild");
const logEsbuildInfo = logEsbuild.extend("info");
const logEsbuildError = logEsbuild.extend("error");
const logEsbuildResolve = logEsbuild.extend("resolve");
const logEsbuildTransform = logEsbuild.extend("transform");

const IGNORED_IMPORT_PATTERNS = [/^cloudflare:.*$/];

const EXTRA_IMPORTS = [
  "react",
  "react-dom/server.edge",
  "react-dom/server",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

// Define import patterns directly in code (from allImportsRule.yml)
const IMPORT_PATTERNS = [
  // Static Imports
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
];

// Shared state for both Vite and esbuild plugins
const virtualSsrDeps = new Map<string, string>();
const depPrefixMap = new Map<string, string>();
const seenBareImports = new Set<string>();
let viteServer: any = null;

/**
 * Find all import specifiers and their positions using ast-grep
 * Returns an array of { s, e, raw } for each import specifier
 */
function findImportSpecifiersWithPositions(
  code: string,
  lang: typeof SgLang.TypeScript | typeof SgLang.Tsx,
): Array<{ s: number; e: number; raw: string }> {
  const results: Array<{ s: number; e: number; raw: string }> = [];
  try {
    const root = sgParse(lang, code);
    for (const pattern of IMPORT_PATTERNS) {
      try {
        const matches = root.root().findAll(pattern);
        for (const match of matches) {
          const moduleCapture = match.getMatch("MODULE");
          if (moduleCapture) {
            // The AST node text includes the quotes for string literals
            const importPath = moduleCapture.text();
            // Only include bare imports (not relative paths, absolute paths, or virtual modules)
            if (
              !importPath.startsWith(".") &&
              !importPath.startsWith("/") &&
              !importPath.startsWith("virtual:") &&
              !IGNORED_IMPORT_PATTERNS.some((pattern) =>
                pattern.test(importPath),
              )
            ) {
              // Find the start and end positions of the import string in the code
              // This is the range of the moduleCapture node
              const { start, end } = moduleCapture.range();
              results.push({ s: start.index, e: end.index, raw: importPath });
            }
          }
        }
      } catch (err) {
        logError("❌ Error processing pattern %s: %O", pattern, err);
      }
    }
  } catch (err) {
    logError("❌ Error parsing content: %O", err);
  }
  return results;
}

// Helper function to check if a path is in node_modules
function isDep(id: string): boolean {
  return id.includes("node_modules") || id.includes(".vite");
}

// Helper to check if a module is a client module (for SSR virtualization)
function isClientModule({
  id,
  code,
  logFn,
  esbuild,
}: {
  id: string;
  code?: string;
  logFn?: (...args: any[]) => void;
  esbuild?: boolean;
}): boolean {
  const logger = logFn ?? (() => {});
  if (id === "rwsdk/__ssr_bridge") {
    logger(
      `[isClientModule] Detected client module (ssr_bridge): id=%s esbuild=%s`,
      id,
      !!esbuild,
    );
    return true;
  }
  if (id.startsWith(SSR_BASE_NAMESPACE)) {
    logger(
      `[isClientModule] Detected client module (SSR_BASE_NAMESPACE): id=%s esbuild=%s`,
      id,
      !!esbuild,
    );
    return true;
  }
  if (
    id.endsWith(".ts") ||
    id.endsWith(".js") ||
    id.endsWith(".tsx") ||
    id.endsWith(".jsx") ||
    id.endsWith(".mjs")
  ) {
    if (code) {
      const firstLine = code.split("\n", 1)[0]?.trim();
      if (
        firstLine.startsWith("'use client'") ||
        firstLine.startsWith('"use client"')
      ) {
        logger(
          `[isClientModule] Detected client module (use client directive): id=%s esbuild=%s`,
          id,
          !!esbuild,
        );
        return true;
      }
    }
  }
  return false;
}

// Helper to check if a path or importer is in the SSR subgraph
function isSSRSubgraph({
  importer,
  path,
}: {
  importer?: string;
  path: string;
}): boolean {
  return (
    (importer && importer.startsWith(SSR_BASE_NAMESPACE)) ||
    path.startsWith(SSR_BASE_NAMESPACE)
  );
}

// --- Shared helpers for SSR subgraph resolution and import rewriting ---

/**
 * Resolves an import to a virtual SSR ID if needed, or returns null if no rewrite is needed.
 * Used by both Vite and esbuild plugins.
 */
function getVirtualSSRImport({
  raw,
  resolvedId,
  depPrefixMap,
  SSR_MODULE_NAMESPACE,
  IGNORED_IMPORT_PATTERNS,
  isDep,
  logFn,
  esbuildHeuristic = false,
}: {
  raw: string;
  resolvedId?: string;
  depPrefixMap: Map<string, string>;
  SSR_MODULE_NAMESPACE: string;
  IGNORED_IMPORT_PATTERNS: RegExp[];
  isDep: (id: string) => boolean;
  logFn?: (...args: any[]) => void;
  esbuildHeuristic?: boolean;
}): string | null {
  // Known mapped dependency
  if (depPrefixMap.has(raw)) {
    const virtualId = depPrefixMap.get(raw)!;
    logFn?.("🔄 Rewriting mapped dep: %s → %s", raw, virtualId);
    return virtualId;
  }
  // Ignored import patterns
  if (IGNORED_IMPORT_PATTERNS.some((pattern) => pattern.test(raw))) {
    logFn?.("🛡️ Ignoring pattern-matched import: %s", raw);
    return null;
  }
  // User code import (not from node_modules)
  if (resolvedId && !isDep(resolvedId)) {
    const virtualId = SSR_MODULE_NAMESPACE + resolvedId;
    logFn?.("🔁 Rewriting user import: %s → %s", raw, virtualId);
    return virtualId;
  }
  // esbuild fallback: if not node_modules/.vite, treat as user code
  if (
    esbuildHeuristic &&
    !raw.includes("node_modules") &&
    !raw.includes(".vite")
  ) {
    const virtualId = SSR_MODULE_NAMESPACE + raw;
    logFn?.("🔁 Rewriting user import (esbuild): %s → %s", raw, virtualId);
    return virtualId;
  }
  // No rewrite
  return null;
}

/**
 * Rewrites imports in a module to their virtual SSR IDs as needed.
 * Used by both Vite and esbuild plugins.
 *
 * @param code The source code
 * @param id The module id (for Vite, used for resolution)
 * @param options Shared and plugin-specific options
 * @param resolveImport Optional async resolver (Vite only)
 * @param esbuildHeuristic If true, use esbuild's heuristic for user code
 * @returns {Promise<string|null>} The rewritten code, or null if unchanged
 */
async function rewriteSSRClientImports({
  code,
  id,
  depPrefixMap,
  SSR_MODULE_NAMESPACE,
  IGNORED_IMPORT_PATTERNS,
  isDep,
  logFn,
  resolveImport,
  esbuildHeuristic = false,
}: {
  code: string;
  id: string;
  depPrefixMap: Map<string, string>;
  SSR_MODULE_NAMESPACE: string;
  IGNORED_IMPORT_PATTERNS: RegExp[];
  isDep: (id: string) => boolean;
  logFn?: (...args: any[]) => void;
  resolveImport?: (raw: string, id: string) => Promise<{ id: string } | null>;
  esbuildHeuristic?: boolean;
}): Promise<string | null> {
  // Determine language based on file extension
  const ext = path.extname(id).toLowerCase();
  const lang =
    ext === ".tsx" || ext === ".jsx" ? SgLang.Tsx : SgLang.TypeScript;
  const imports = findImportSpecifiersWithPositions(code, lang);
  const ms = new MagicString(code);
  let modified = false;
  for (const i of imports) {
    const raw = i.raw;
    if (raw === "rwsdk/__ssr_bridge") continue;
    let resolvedId: string | undefined = undefined;
    if (resolveImport) {
      try {
        const resolved = await resolveImport(raw, id);
        resolvedId = resolved?.id;
      } catch {}
    }
    const virtualId = getVirtualSSRImport({
      raw,
      resolvedId,
      depPrefixMap,
      SSR_MODULE_NAMESPACE,
      IGNORED_IMPORT_PATTERNS,
      isDep,
      logFn,
      esbuildHeuristic,
    });
    if (virtualId) {
      ms.overwrite(i.s, i.e, virtualId);
      modified = true;
    }
  }
  return modified ? ms.toString() : null;
}

// --- SSR-aware esbuild plugin for optimizeDeps ---
function virtualizedSSREsbuildPlugin() {
  return {
    name: "virtualized-ssr-esbuild-plugin",
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        // If the importer or the path is in the SSR subgraph, use the same logic as Vite
        if (isSSRSubgraph({ importer: args.importer, path: args.path })) {
          // Use shared logic for SSR subgraph resolution
          const virtualId = getVirtualSSRImport({
            raw: args.path,
            depPrefixMap,
            SSR_MODULE_NAMESPACE,
            IGNORED_IMPORT_PATTERNS,
            isDep,
            logFn: logEsbuildResolve,
            esbuildHeuristic: true,
          });
          if (virtualId) {
            return { path: virtualId, external: false };
          }
        }
        // Let esbuild handle other cases
        return undefined;
      });
      // --- onLoad for 'use client' modules ---
      build.onLoad(
        { filter: /\.(js|jsx|ts|tsx|mjs|mts)$/ },
        async (args: any) => {
          const fs = await import("fs/promises");
          let code: string;
          try {
            code = await fs.readFile(args.path, "utf-8");
          } catch (err) {
            logEsbuildError("❌ Failed to read file in onLoad: %s", args.path);
            return undefined;
          }
          if (
            isClientModule({
              id: args.path,
              code,
              logFn: logEsbuildTransform,
              esbuild: true,
            })
          ) {
            logEsbuildTransform("🎯 Found 'use client' in: %s", args.path);
            const rewritten = await rewriteSSRClientImports({
              code,
              id: args.path,
              depPrefixMap,
              SSR_MODULE_NAMESPACE,
              IGNORED_IMPORT_PATTERNS,
              isDep,
              logFn: logEsbuildTransform,
              esbuildHeuristic: true,
            });
            if (rewritten) {
              return {
                contents: rewritten,
                loader: args.path.endsWith("x") ? "tsx" : "ts",
              };
            }
          }
          // Not a 'use client' module, or no changes needed
          return undefined;
        },
      );
    },
  };
}

export function virtualizedSSRPlugin({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin {
  logInfo(
    "🚀 Initializing VirtualizedSSR plugin with root: %s",
    projectRootDir,
  );
  logInfo(
    "📂 Plugin will handle client/server module resolution in a single Vite worker environment",
  );

  const ssrResolver = enhancedResolve.create.sync({
    conditionNames: ["workerd", "edge", "import", "default"],
  });

  /**
   * Resolves a bare import and adds it to our dependency mappings
   * This is the ONLY place where ssrResolver should be used
   * @returns true if a new dependency was resolved and added
   */
  async function resolveBareImport(importPath: string): Promise<boolean> {
    seenBareImports.add(importPath);

    // Skip if already in our mappings
    if (depPrefixMap.has(importPath)) {
      return false;
    }

    logResolve("🔍 Resolving bare import: %s", importPath);

    try {
      let resolved: string | false = false;

      try {
        // This is the only place where ssrResolver should be used
        resolved = ssrResolver(projectRootDir, importPath);
      } catch {
        resolved = false;
      }

      if (!resolved) {
        logResolve(
          "⚠️ Could not resolve in projectRootDir, trying sdk: %s",
          importPath,
        );
        try {
          resolved = ssrResolver(ROOT_DIR, importPath);
        } catch {
          resolved = false;
        }
      }

      if (!resolved) {
        logResolve("⚠️ Could not resolve in sdk: %s", importPath);
        return false;
      }

      // Create virtual ID and add to mappings
      const virtualId = SSR_DEP_NAMESPACE + importPath;
      virtualSsrDeps.set(virtualId, resolved);

      // Add to prefix map for rewriting imports
      depPrefixMap.set(importPath, virtualId);

      logResolve("✅ Resolved %s -> %s", importPath, resolved);
      return true;
    } catch (err) {
      logError("❌ Failed to resolve %s: %O", importPath, err);
      return false;
    }
  }

  /**
   * Updates Vite config with new dependencies and triggers optimization
   */
  function updateAndOptimize(): void {
    if (!viteServer) {
      logInfo("⚠️ Vite server not available, skipping optimization");
      return;
    }

    logInfo("🔄 Updating Vite config with dependencies");

    // Update optimizeDeps and alias
    updateViteConfig();

    // Trigger re-optimization
    viteServer.optimizeDeps();
    logInfo("✅ Triggered dependencies re-optimization");
  }

  /**
   * Process a collection of bare imports, resolving and adding them to mappings
   * @returns true if any new dependencies were added
   */
  async function processBareImports(
    imports: Set<string> | string[],
  ): Promise<boolean> {
    let newDepsFound = false;

    for (const importPath of imports) {
      const resolved = await resolveBareImport(importPath);
      if (resolved) {
        newDepsFound = true;
      }
    }

    return newDepsFound;
  }

  /**
   * Scans source files using ast-grep/napi to find bare imports
   */
  async function scanWithAstGrep(srcDir: string): Promise<Set<string>> {
    const imports = new Set<string>();

    try {
      logScan("🔍 Using ast-grep/napi to scan for imports");

      // Use glob to find all JS/TS files
      const files = await glob(`${srcDir}/**/*.{js,jsx,ts,tsx,mjs,mts}`, {
        absolute: true,
      });
      logScan("📊 Found %d files to scan", files.length);

      for (const file of files) {
        try {
          // Read the file content
          const content = await fs.readFile(file, "utf-8");

          // Determine language based on file extension
          const ext = path.extname(file).toLowerCase();
          const lang =
            ext === ".tsx" || ext === ".jsx" ? SgLang.Tsx : SgLang.TypeScript;

          // Extract bare imports from this file
          const fileImports = findImportSpecifiersWithPositions(content, lang);

          // Add to our collective set
          for (const importPath of fileImports.map((i) => i.raw)) {
            imports.add(importPath);
          }
        } catch (err) {
          logError("❌ Error scanning file %s: %O", file, err);
        }
      }

      for (const extra of EXTRA_IMPORTS) {
        imports.add(extra);
      }

      // Process and resolve all the unique bare imports we found
      await processBareImports(imports);

      logScan("📊 Found %d unique bare imports: %O", imports.size, imports);
    } catch (err) {
      logError("❌ Error during ast-grep scan: %O", err);
    }

    return imports;
  }

  async function processNewFile(filePath: string): Promise<void> {
    logWatch("🔄 Processing file change: %s", filePath);

    try {
      // Extract bare imports using ast-grep/napi directly on the changed file
      logWatch("🔍 Using ast-grep/napi to process changed file");

      // Read the file content
      const content = await fs.readFile(filePath, "utf-8");

      // Determine language based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const lang =
        ext === ".tsx" || ext === ".jsx" ? SgLang.Tsx : SgLang.TypeScript;

      // Use our shared function to extract bare imports
      const bareImports = findImportSpecifiersWithPositions(content, lang);

      if (bareImports.length === 0) {
        logWatch("⏭️ No bare imports found in changed file");
        return;
      }

      logWatch("📊 Found %d bare imports in changed file", bareImports.length);

      // Process the imports and check if any new ones were added
      const newDepsFound = await processBareImports(
        bareImports.map((i) => i.raw),
      );

      // If new dependencies were found, update Vite config
      if (newDepsFound && viteServer) {
        logWatch("🔄 New dependencies found, updating configuration");
        updateAndOptimize();
      }
    } catch (err) {
      logError("❌ Failed to process file change %s: %O", filePath, err);
    }
  }

  function updateViteConfig(): void {
    if (!viteServer || !viteServer.config) {
      logError("⚠️ Cannot update Vite config, server not available");
      return;
    }

    const config = viteServer.config;

    // Update resolve.alias
    config.resolve ??= {};
    config.resolve.alias ??= [];

    if (!Array.isArray(config.resolve.alias)) {
      const aliasObj = config.resolve.alias;
      config.resolve.alias = Object.entries(aliasObj).map(
        ([find, replacement]) => ({ find, replacement }),
      );
    }

    // Clear existing aliases for our namespace
    config.resolve.alias = config.resolve.alias.filter(
      (alias: any) =>
        typeof alias.find !== "object" ||
        !String(alias.find).includes(SSR_BASE_NAMESPACE),
    );

    // Add all current virtual SSR deps as aliases
    for (const [vId, realPath] of virtualSsrDeps) {
      config.resolve.alias.push({
        find: new RegExp(`^${vId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
        replacement: realPath,
      });
    }

    // Update optimizeDeps
    config.optimizeDeps ??= {};
    config.optimizeDeps.include ??= [];

    // Add all our virtual deps to optimizeDeps.include
    for (const vId of virtualSsrDeps.keys()) {
      if (!config.optimizeDeps.include.includes(vId)) {
        config.optimizeDeps.include.push(vId);
      }
    }

    config.optimizeDeps.esbuildOptions ??= {};
    config.optimizeDeps.esbuildOptions.plugins ??= [];
    // Remove any existing instance to avoid duplicates
    config.optimizeDeps.esbuildOptions.plugins =
      config.optimizeDeps.esbuildOptions.plugins.filter(
        (p: any) => p?.name !== "virtualized-ssr-esbuild-plugin",
      );
    // Insert at the start so it runs before use-client-esbuild-plugin
    config.optimizeDeps.esbuildOptions.plugins.unshift(
      virtualizedSSREsbuildPlugin(),
    );

    logInfo(
      "✅ Updated Vite config with %d SSR virtual aliases",
      virtualSsrDeps.size,
    );
  }

  return {
    name: "rwsdk:virtualized-ssr",

    configureServer(server) {
      viteServer = server;

      // Set up watcher for src directory
      const srcDir = path.join(projectRootDir, "src");
      logWatch("👀 Setting up file watcher for: %s", srcDir);

      // Watch for file changes in src directory
      server.watcher.on("add", (path: string) => {
        if (
          path.startsWith(srcDir) &&
          /\.(js|jsx|ts|tsx|mjs|mts)$/.test(path)
        ) {
          processNewFile(path);
        }
      });

      server.watcher.on("change", (path: string) => {
        if (
          path.startsWith(srcDir) &&
          /\.(js|jsx|ts|tsx|mjs|mts)$/.test(path)
        ) {
          processNewFile(path);
        }
      });
    },

    async configEnvironment(env, config) {
      logInfo("⚙️ Configuring environment: %s", env);

      if (env !== "worker") {
        logInfo("⏭️ Skipping non-worker environment");
        return;
      }

      logInfo("⚙️ Setting up aliases for worker environment");
      logInfo("📊 Configuration state:");
      logInfo("   - Project root: %s", projectRootDir);
      logInfo("   - Virtual SSR namespace: %s", SSR_BASE_NAMESPACE);

      config.resolve ??= {};
      (config.resolve as any).alias ??= [];

      if (!Array.isArray((config.resolve as any).alias)) {
        logInfo("⚙️ Converting alias object to array");
        const aliasObj = (config.resolve as any).alias;
        (config.resolve as any).alias = Object.entries(aliasObj).map(
          ([find, replacement]) => ({ find, replacement }),
        );
      }

      // Scan src directory for imports
      logResolve("🔍 Scanning src directory for bare imports");

      try {
        const srcDir = path.join(projectRootDir, "src");
        logScan("📂 Scanning directory: %s", srcDir);

        logScan("✅ Using ast-grep for import scanning");
        // This will find all imports and add them to virtualSsrDeps internally
        await scanWithAstGrep(srcDir);
      } catch (err) {
        logError("❌ Error scanning src directory: %O", err);
      }

      logResolve(
        "📊 Found %d dependencies after scanning",
        virtualSsrDeps.size,
      );

      // Add all aliases to config
      for (const [vId, realPath] of virtualSsrDeps) {
        (config.resolve as any).alias.push({
          find: new RegExp(`^${vId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
          replacement: realPath,
        });
        logInfo("🔗 Added alias: %s -> %s", vId, realPath);
      }

      config.optimizeDeps ??= {};
      config.optimizeDeps.include ??= [];
      config.optimizeDeps.include.push(...virtualSsrDeps.keys());
      logInfo(
        "⚡ Added %d virtual deps to optimizeDeps.include",
        virtualSsrDeps.size,
      );

      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];
      // Remove any existing instance to avoid duplicates
      config.optimizeDeps.esbuildOptions.plugins =
        config.optimizeDeps.esbuildOptions.plugins.filter(
          (p: any) => p?.name !== "virtualized-ssr-esbuild-plugin",
        );
      // Insert at the start so it runs before use-client-esbuild-plugin
      config.optimizeDeps.esbuildOptions.plugins.unshift(
        virtualizedSSREsbuildPlugin(),
      );

      logInfo(
        "✅ Updated Vite config with %d SSR virtual aliases",
        virtualSsrDeps.size,
      );
    },

    async transform(code, id, options) {
      if (this.environment.name !== "worker") {
        return null;
      }
      logTransform("📝 Transform: %s", id);
      if (!isClientModule({ id, code, logFn: logTransform, esbuild: false })) {
        logTransform("⏭️ Skipping non-client module: %s", id);
        return null;
      }
      // Process imports directly in transform
      logTransform("🔎 Processing imports in client module: %s", id);
      const rewritten = await rewriteSSRClientImports({
        code,
        id,
        depPrefixMap,
        SSR_MODULE_NAMESPACE,
        IGNORED_IMPORT_PATTERNS,
        isDep,
        logFn: logTransform,
        resolveImport: async (raw, importer) => {
          const resolved = await this.resolve(raw, importer, {
            skipSelf: true,
          });
          return resolved && resolved.id ? { id: resolved.id } : null;
        },
      });
      return rewritten
        ? {
            code: rewritten,
            map: new MagicString(rewritten).generateMap({ hires: true }),
          }
        : null;
    },

    resolveId(source, importer, options) {
      logResolve("🔍 Resolving %s", source);
      // Handle virtualized imports
      if (source.startsWith(SSR_BASE_NAMESPACE)) {
        const isDepNamespace = source.startsWith(SSR_DEP_NAMESPACE);
        const moduleId = isDepNamespace
          ? source.slice(SSR_DEP_NAMESPACE.length)
          : source.slice(SSR_MODULE_NAMESPACE.length);

        logResolve(
          "🔍 Resolving virtual %s: %s",
          isDepNamespace ? "dependency" : "module",
          moduleId,
        );

        // Check if it's a known virtual dependency
        if (virtualSsrDeps.has(source)) {
          const realPath = virtualSsrDeps.get(source)!;
          logResolve("✨ Using cached virtual dep: %s → %s", source, realPath);
          return realPath;
        }

        // Return the virtual ID for further processing
        logResolve("📦 Returning virtual ID for transform(): %s", source);
        return source;
      }

      // Handle imports coming from within the virtual graph
      if (isSSRSubgraph({ importer, path: source })) {
        // Known bare import mapping
        if (depPrefixMap.has(source)) {
          const virtualId = depPrefixMap.get(source)!;
          logResolve(
            "🔁 Rewriting known dep inside virtual graph: %s → %s",
            source,
            virtualId,
          );
          return virtualId;
        }

        // For relative or absolute paths, just prefix with module namespace and let Vite resolve
        if (source.startsWith(".") || source.startsWith("/")) {
          const virtualId = SSR_MODULE_NAMESPACE + source;
          logResolve(
            "🔁 Prefixing relative/absolute import for virtual resolution: %s → %s",
            source,
            virtualId,
          );
          return virtualId;
        }

        logResolve("⚠️ Unresolved import in virtual context: %s", source);
      }

      // Let Vite handle other imports
      return null;
    },

    load(id) {
      if (!id.startsWith(SSR_BASE_NAMESPACE)) return null;

      const isDepNamespace = id.startsWith(SSR_DEP_NAMESPACE);
      const maybePath = isDepNamespace
        ? id.slice(SSR_DEP_NAMESPACE.length)
        : id.slice(SSR_MODULE_NAMESPACE.length);

      // Handle known virtual dependencies
      if (virtualSsrDeps.has(id)) {
        const realPath = virtualSsrDeps.get(id)!;
        logResolve("📄 load() returning known dep: %s → %s", id, realPath);
        return fs.readFile(realPath, "utf-8");
      }

      // Fallback to trying to read the file directly
      try {
        logResolve(
          "📄 load() reading file for transform() as separate SSR module: %s",
          maybePath,
        );
        return fs.readFile(maybePath, "utf-8");
      } catch {
        logResolve("❌ load() read failed for: %s", maybePath);
        return null;
      }
    },
  };
}
