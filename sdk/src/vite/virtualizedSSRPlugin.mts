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
import { ROOT_DIR } from "../lib/constants.mjs";
import { transformClientComponents } from "./useClientPlugin.mjs";

export const SSR_NAMESPACE = "virtual:rwsdk:ssr:";

const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");

// Esbuild-specific loggers
const logEsbuild = debug("rwsdk:vite:virtualized-ssr:esbuild");
const logEsbuildTransform = logEsbuild.extend("transform");

const IGNORED_IMPORT_PATTERNS = [/^cloudflare:.*$/];

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

  // CommonJS require
  'require("$MODULE")',
  "require('$MODULE')",
  "require(`$MODULE`)",
];

const baseSSRResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

const ssrResolver = (from: string, request: string): string | false => {
  try {
    return baseSSRResolver(path.dirname(from), request);
  } catch {
    return false;
  }
};

const createSSRDepResolver = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  const resolveSSRDep = (request: string): string | false => {
    try {
      return baseSSRResolver(projectRootDir, request);
    } catch {
      try {
        return baseSSRResolver(ROOT_DIR, request);
      } catch {
        return false;
      }
    }
  };

  return resolveSSRDep;
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

// --- Context type for shared state ---
export type VirtualizedSSRContext = {
  projectRootDir: string;
  resolveModule: (
    from: string,
    request: string,
  ) => string | false | Promise<string | false>;
  resolveDep: (request: string) => string | false;
};

// Utility to check for bare imports (not relative, not absolute, not virtual)
function isBareImport(importPath: string): boolean {
  return (
    !importPath.startsWith(".") &&
    !importPath.startsWith("/") &&
    !importPath.startsWith("virtual:")
  );
}

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
}): Promise<MagicString | null> {
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
    if (raw.startsWith(SSR_NAMESPACE)) {
      logFn?.(
        "[rewriteSSRClientImports] Skipping already-virtual import: %s",
        raw,
      );
      continue;
    }

    let virtualId: string | null = null;

    let moduleResolved: string | false = false;

    try {
      moduleResolved = await context.resolveModule(id, raw);
    } catch (err) {
      logError("❌ Error resolving module: %s", err);
    }

    if (isBareImport(raw)) {
      const ssrResolved = context.resolveDep(raw);

      if (ssrResolved !== false) {
        if (ssrResolved === moduleResolved) {
          logFn?.(
            "[rewriteSSRClientImports] SSR resolver matched module resolver result for bare import '%s', treating it as a non-virtual module: %s",
            raw,
            ssrResolved,
          );
          virtualId = moduleResolved;
        } else {
          logFn?.(
            "[rewriteSSRClientImports] SSR resolver succeeded for bare import '%s', rewriting to '%s'",
            raw,
            ssrResolved,
          );
          virtualId = SSR_NAMESPACE + ssrResolved;
        }
      }
    }

    if (virtualId === null) {
      if (moduleResolved) {
        logFn?.(
          "[rewriteSSRClientImports] Module resolver succeeded for import '%s' from %s, rewriting to '%s'",
          raw,
          id,
          moduleResolved,
        );
        virtualId = SSR_NAMESPACE + moduleResolved;
      } else {
        logFn?.(
          "[rewriteSSRClientImports] Module resolver failed for import '%s' from %s, leaving as is",
          raw,
          id,
        );
      }
    }

    if (virtualId !== null) {
      ms.overwrite(i.s, i.e, virtualId);
      modified = true;
    }
  }

  if (modified) {
    logFn?.("[rewriteSSRClientImports] Rewriting complete for %s", id);
    return ms;
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
  if (id.includes("__rwsdk_ssr")) {
    logger(
      `[isClientModule] Detected client module (includes __rwsdk_ssr): id=%s esbuild=%s`,
      id,
      !!esbuild,
    );
    return true;
  }
  if (id.startsWith(SSR_NAMESPACE)) {
    logger(
      `[isClientModule] Detected client module (SSR_NAMESPACE): id=%s esbuild=%s`,
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
    (importer && importer.startsWith(SSR_NAMESPACE)) ||
    path.startsWith(SSR_NAMESPACE) ||
    path.includes("__rwsdk_ssr")
  );
}

// Shared function to rewrite imports if needed (no file reading)
async function maybeRewriteSSRClientImports({
  code,
  id,
  context,
  logFn,
}: {
  code: string;
  id: string;
  context: VirtualizedSSRContext;
  logFn: (...args: any[]) => void;
}) {
  const isClient = isClientModule({
    id,
    code,
    logFn,
    esbuild: true,
  });
  if (isClient) {
    logFn(
      `[maybeRewriteSSRClientImports] Rewriting imports for %s (isClient: %s)`,
      id,
      isClient,
    );
    const rewritten = await rewriteSSRClientImports({
      code,
      id,
      context,
      logFn,
    });
    if (rewritten) {
      return rewritten.toString();
    } else {
      logFn(
        `[maybeRewriteSSRClientImports] No rewrite needed for %s (isClient: %s)`,
        id,
        isClient,
      );
    }
  } else {
    logFn(
      `[maybeRewriteSSRClientImports] Not a client module, no rewrite needed: %s`,
      id,
    );
  }
  return null;
}

// Loads a file, maybe rewrites SSR client imports, then always runs transformClientComponents
async function loadAndTransformClientModule({
  filePath,
  context,
  logFn,
}: {
  filePath: string;
  context: VirtualizedSSRContext;
  logFn: (...args: any[]) => void;
}) {
  const realPath = filePath.startsWith(SSR_NAMESPACE)
    ? filePath.slice(SSR_NAMESPACE.length)
    : filePath;
  let code: string;
  try {
    code = await fs.readFile(realPath, "utf-8");
  } catch (err) {
    logFn("❌ Failed to read file: %s", realPath);
    return undefined;
  }
  const rewritten = await maybeRewriteSSRClientImports({
    code,
    id: filePath,
    context,
    logFn,
  });

  const codeToTransform = rewritten ?? code;

  const clientResult = await transformClientComponents(
    codeToTransform,
    filePath,
    {
      environmentName: "worker",
      isEsbuild: true,
    },
  );
  const finalCode = clientResult?.code ?? codeToTransform;
  return {
    contents: finalCode,
    loader: realPath.endsWith(".tsx")
      ? "tsx"
      : realPath.endsWith(".jsx")
        ? "jsx"
        : realPath.endsWith(".ts")
          ? "ts"
          : "js",
    resolveDir: path.dirname(realPath),
  };
}

function virtualizedSSREsbuildPlugin(context: VirtualizedSSRContext) {
  return {
    name: "virtualized-ssr-esbuild-plugin",
    setup(build: any) {
      build.onResolve({ filter: /^virtual:rwsdk:ssr:/ }, (args: any) => ({
        path: args.path,
        namespace: SSR_NAMESPACE,
      }));

      build.onLoad(
        { filter: /.*/, namespace: SSR_NAMESPACE },
        async (args: any) => {
          logEsbuild("[esbuild:onLoad:module] called with args: %O", args);
          return loadAndTransformClientModule({
            filePath: args.path,
            context,
            logFn: logEsbuildTransform,
          });
        },
      );

      build.onLoad(
        { filter: /\.(js|jsx|ts|tsx|mjs|mts)$/ },
        async (args: any) => {
          logEsbuild("[esbuild:onLoad:rewrite] called with args: %O", args);
          return loadAndTransformClientModule({
            filePath: args.path,
            context,
            logFn: logEsbuildTransform,
          });
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

  const context: VirtualizedSSRContext = {
    projectRootDir,
    resolveModule: ssrResolver,
    resolveDep: createSSRDepResolver({ projectRootDir }),
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
      logInfo("   - Virtual SSR namespace: %s", SSR_NAMESPACE);

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

    load(id) {
      if (!id.startsWith(SSR_NAMESPACE)) return null;

      const moduleId = id.slice(SSR_NAMESPACE.length);

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

    async transform(code, id) {
      if (this.environment.name !== "worker") {
        return null;
      }

      logTransform("📝 Transform: %s", id);

      if (!isClientModule({ id, code, logFn: logTransform, esbuild: false })) {
        logTransform("⏭️ Skipping non-client module: %s", id);
        return null;
      }

      logTransform("🔎 Processing imports in client module: %s", id);

      const rewritten = await maybeRewriteSSRClientImports({
        code,
        id,
        context,
        logFn: logTransform,
      });

      if (!rewritten) {
        logTransform("⏭️ No changes made for %s", id);
        return null;
      }

      return {
        code: rewritten,
        map: undefined,
      };
    },
  };
}
