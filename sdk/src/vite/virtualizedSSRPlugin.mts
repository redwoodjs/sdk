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
 * - Maintain an SSR subgraph as part of the worker environment's module graph.
 *   Any time we see "use client", we enter the subgraph.
 * - We keep the graphs separate by rewriting imports to map to virtual files.
 * - Bare imports to deps get resolved using a custom resolver so that we use
 *   import conditions relevant to SSR - note the lack of "react-server"
 *   condition: ["workerd", "edge", "import", "default"]
 * - All imports within the subgraph get their path rewritten with the SSR
 *   module namespace prefix so that we stay within the subgraph.
 */

import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";
import enhancedResolve from "enhanced-resolve";
import MagicString from "magic-string";
import debug from "debug";
import { parse as sgParse, Lang as SgLang } from "@ast-grep/napi";

export const SSR_BASE_NAMESPACE = "virtual:rwsdk:ssr:";

const ESBUILD_SSR_DEP_NAMESPACE = "rwsdk:ssr:dep";
const ESBUILD_SSR_MODULE_NAMESPACE = "rwsdk:ssr:module";

const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");

// Esbuild-specific loggers
const logEsbuild = debug("rwsdk:vite:virtualized-ssr:esbuild");
const logEsbuildInfo = logEsbuild.extend("info");
const logEsbuildError = logEsbuild.extend("error");
const logEsbuildResolve = logEsbuild.extend("resolve");
const logEsbuildTransform = logEsbuild.extend("transform");

const IGNORED_IMPORT_PATTERNS = [/^cloudflare:.*$/];

// Shared state for both Vite and esbuild plugins
const virtualSsrDeps = new Map<string, string>();

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

const createSSRResolver = ({ projectRootDir }: { projectRootDir: string }) => {
  const ssrResolver = enhancedResolve.create.sync({
    conditionNames: ["workerd", "edge", "import", "default"],
  });

  const ssrResolverFn = (request: string): string | false => {
    try {
      return ssrResolver(projectRootDir, request);
    } catch {
      return false;
    }
  };

  return ssrResolverFn;
};

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
        // logError("❌ Error processing pattern %s: %O", pattern, err);
      }
    }
  } catch (err) {
    // logError("❌ Error parsing content: %O", err);
  }
  return results;
}

// --- Context type for shared state ---
export type VirtualizedSSRContext = {
  projectRootDir: string;
  ssrResolver: (request: string) => string | false;
  IGNORED_IMPORT_PATTERNS: RegExp[];
  SSR_BASE_NAMESPACE: string;
  virtualSsrDeps: Map<string, string>;
};

// Update rewriteSSRClientImports to accept context
async function rewriteSSRClientImports({
  code,
  id,
  context,
  logFn,
}: {
  code: string;
  id: string;
  context: VirtualizedSSRContext;
  logFn?: (...args: any[]) => void;
}): Promise<string | null> {
  logFn?.("[rewriteSSRClientImports] called for id: %s", id);
  const ext = path.extname(id).toLowerCase();
  const lang =
    ext === ".tsx" || ext === ".jsx" ? SgLang.Tsx : SgLang.TypeScript;
  const imports = findImportSpecifiersWithPositions(code, lang);
  logFn?.(
    "[rewriteSSRClientImports] Found %d imports in %s",
    imports.length,
    id,
  );
  const ms = new MagicString(code);
  let modified = false;
  for (const i of imports) {
    const raw = i.raw;
    logFn?.(
      "[rewriteSSRClientImports] Processing import '%s' at [%d, %d]",
      raw,
      i.s,
      i.e,
    );
    // Skip rewriting if already a virtual SSR ID
    if (raw.startsWith(context.SSR_BASE_NAMESPACE)) {
      logFn?.(
        "[rewriteSSRClientImports] Skipping already-virtual import: %s",
        raw,
      );
      continue;
    }
    // All imports get the prefix
    const virtualId = context.SSR_BASE_NAMESPACE + raw;
    logFn?.(
      "[rewriteSSRClientImports] Rewriting import '%s' → '%s'",
      raw,
      virtualId,
    );
    ms.overwrite(i.s, i.e, virtualId);
    modified = true;
  }
  if (modified) {
    logFn?.("[rewriteSSRClientImports] Rewriting complete for %s", id);
    return ms.toString();
  } else {
    logFn?.("[rewriteSSRClientImports] No changes made for %s", id);
    return null;
  }
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
    path.startsWith(SSR_BASE_NAMESPACE) ||
    path.includes("__rwsdk_ssr")
  );
}

// Update getVirtualSSRImport to accept context
function getVirtualSSRImport({
  raw,
  context,
  logFn,
}: {
  raw: string;
  context: VirtualizedSSRContext;
  logFn?: (...args: any[]) => void;
}): string | null {
  if (context.IGNORED_IMPORT_PATTERNS.some((pattern) => pattern.test(raw))) {
    logFn?.("🛡️ Ignoring pattern-matched import: %s", raw);
    return null;
  }
  // All imports get the prefix
  const virtualId = context.SSR_BASE_NAMESPACE + raw;
  logFn?.("��Rewriting bimport %s → %s , raw, virtualId,);
  return virtualId;
}

// Update virtualizedSSREsbuildPlugin to accept context
function virtualizedSSREsbuildPlugin(context: VirtualizedSSRContext) {
  return {
    name: "virtualized-ssr-esbuild-plugin",
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        logEsbuildResolve("[esbuild:onResolve] called with args: %O", args);
        if (isSSRSubgraph({ importer: args.importer, path: args.path })) {
          logEsbuildResolve(
            "[esbuild:onResolve] SSR subgraph detected for %s (importer: %s)",
            args.path,
            args.importer,
          );
          // Use context's ssrResolver
          const virtualId = getVirtualSSRImport({
            raw: args.path,
            context,
            logFn: logEsbuildResolve,
          });
          if (virtualId) {
            logEsbuildResolve(
              "[esbuild:onResolve] Returning virtualId: %s",
              virtualId,
            );
            // Always use ESBUILD_SSR_MODULE_NAMESPACE for all virtualized imports
            return {
              path: virtualId,
              namespace: ESBUILD_SSR_MODULE_NAMESPACE,
            };
          } else {
            logEsbuildResolve(
              "[esbuild:onResolve] No virtualId for %s",
              args.path,
            );
          }
        }
        logEsbuildResolve(
          "[esbuild:onResolve] Letting esbuild handle %s",
          args.path,
        );
        return undefined;
      });

      build.onLoad(
        { filter: /.*/, namespace: ESBUILD_SSR_MODULE_NAMESPACE },
        async (args: any) => {
          logEsbuild("[esbuild:onLoad:module] called with args: %O", args);
          const realPath = args.path.slice(context.SSR_BASE_NAMESPACE.length);
          try {
            const contents = await (
              await import("fs/promises")
            ).readFile(realPath, "utf-8");
            logEsbuild(
              "[esbuild:onLoad:module] Loaded contents for %s",
              realPath,
            );
            return {
              contents,
              loader: realPath.endsWith("x") ? "tsx" : "ts",
            };
          } catch (err) {
            logEsbuildError("❌ Failed to read real module file: %s", realPath);
            return undefined;
          }
        },
      );

      // Add import rewriting for relevant file types (js, jsx, ts, tsx, mjs, mts)
      build.onLoad(
        { filter: /\.(js|jsx|ts|tsx|mjs|mts)$/ },
        async (args: any) => {
          logEsbuild("[esbuild:onLoad:rewrite] called with args: %O", args);
          let code: string;
          try {
            code = await fs.readFile(args.path, "utf-8");
          } catch (err) {
            logEsbuildError("❌ Failed to read file in onLoad: %s", args.path);
            return undefined;
          }
          const isClient = isClientModule({
            id: args.path,
            code,
            logFn: logEsbuildTransform,
            esbuild: true,
          });
          if (isClient) {
            logEsbuildTransform(
              `[esbuild:onLoad:rewrite] Rewriting imports for %s (isClient: %s)`,
              args.path,
              isClient,
            );
            // Use context
            const rewritten = await rewriteSSRClientImports({
              code,
              id: args.path,
              context,
              logFn: logEsbuildTransform,
            });
            if (rewritten) {
              return {
                contents: rewritten,
                loader: args.path.endsWith("x") ? "tsx" : "ts",
              };
            }
          }
          // Not a 'use client' module or SSR subgraph, or no changes needed
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

  // Create context object
  const context: VirtualizedSSRContext = {
    projectRootDir,
    ssrResolver: createSSRResolver({ projectRootDir }),
    IGNORED_IMPORT_PATTERNS,
    SSR_BASE_NAMESPACE,
    virtualSsrDeps,
  };

  return {
    name: "rwsdk:virtualized-ssr",

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

      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];
      config.optimizeDeps.esbuildOptions.plugins =
        config.optimizeDeps.esbuildOptions.plugins.filter(
          (p: any) => p?.name !== "virtualized-ssr-esbuild-plugin",
        );
      config.optimizeDeps.esbuildOptions.plugins.unshift(
        virtualizedSSREsbuildPlugin(context),
      );

      logInfo(
        "✅ Updated Vite config to use only esbuild plugin for SSR virtual deps",
      );
    },

    resolveId(source, importer, options) {
      logResolve("🔍 Resolving %s", source);
      if (source.startsWith(context.SSR_BASE_NAMESPACE)) {
        const moduleId = source.slice(context.SSR_BASE_NAMESPACE.length);
        logResolve("🔍 Resolving virtual import: %s", moduleId);
        // Try SSR resolver for bare imports
        if (!moduleId.startsWith(".") && !moduleId.startsWith("/")) {
          const resolved = context.ssrResolver(moduleId);
          if (typeof resolved === "string") {
            logResolve("✨ SSR resolver resolved: %s → %s", moduleId, resolved);
            return resolved;
          }
          logResolve("❌ SSR resolver failed for: %s", moduleId);
          // Delegate to Vite
          return null;
        }
        // For relative/absolute, just strip prefix and let Vite handle
        return moduleId;
      }
      // Let Vite handle other imports
      return null;
    },

    load(id) {
      if (!id.startsWith(context.SSR_BASE_NAMESPACE)) return null;

      const moduleId = id.slice(context.SSR_BASE_NAMESPACE.length);

      // Handle known virtual dependencies
      if (context.virtualSsrDeps.has(id)) {
        const realPath = context.virtualSsrDeps.get(id)!;
        logResolve("📄 load() returning known dep: %s → %s", id, realPath);
        return fs.readFile(realPath, "utf-8");
      }

      // Fallback to trying to read the file directly
      try {
        logResolve(
          "📄 load() reading file for transform() as separate SSR module: %s",
          moduleId,
        );
        return fs.readFile(moduleId, "utf-8");
      } catch {
        logResolve("❌ load() read failed for: %s", moduleId);
        return null;
      }
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
      // Use context
      const rewritten = await rewriteSSRClientImports({
        code,
        id,
        context,
        logFn: logTransform,
      });
      return rewritten
        ? {
            code: rewritten,
            map: new MagicString(rewritten).generateMap({ hires: true }),
          }
        : null;
    },
  };
}
