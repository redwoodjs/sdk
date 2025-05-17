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
 * - We keep the graphs separate by rewriting imports in SSR graph to map to virtual files.
 * - Bare imports to deps get resolved using a custom resolver so that we use
 *   import conditions relevant to SSR - note the lack of "react-server"
 *   condition: ["workerd", "edge", "import", "default"]
 * - All imports within the subgraph get their path rewritten with the SSR
 *   module namespace prefix so that we stay within the subgraph.
 */

import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";
import { createModuleResolver } from "./moduleResolver.mjs";
import MagicString from "magic-string";
import debug from "debug";
import { ROOT_DIR } from "../lib/constants.mjs";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { transformServerReferences } from "./transformServerReferences.mjs";
import { findImportSpecifiers } from "./findImportSpecifiers.mjs";

export const SSR_NAMESPACE = "virtual:rwsdk:ssr";
export const SSR_NAMESPACE_PREFIX = SSR_NAMESPACE + ":";

export const SSR_ESBUILD_NAMESPACE = "__rwsdk_ssr_esbuild_namespace__";

export const SSR_RESOLVER_CONDITION_NAMES = [
  "workerd",
  "edge",
  "import",
  "default",
];

const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");

const logEsbuild = debug("rwsdk:vite:virtualized-ssr:esbuild");
const logEsbuildTransform = logEsbuild.extend("transform");

const IGNORED_IMPORT_PATTERNS = [
  /^cloudflare:.*/,
  /^rwsdk\/worker$/,
  /^react\/jsx-runtime$/,
  /^react\/jsx-dev-runtime$/,
];

const createSSRDepResolver = ({ projectRootDir }: { projectRootDir: string }) =>
  createModuleResolver({
    roots: [projectRootDir, ROOT_DIR],
    name: "resolveDep",
    conditionNames: SSR_RESOLVER_CONDITION_NAMES,
  });

export type VirtualizedSSRContext = {
  projectRootDir: string;
  config: any;
  resolveModule: (
    request: string,
    importer: string,
  ) => string | false | Promise<string | false>;
  resolveDep: (request: string) => string | false;
};

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
  shouldRewriteBareImports,
}: {
  code: string;
  id: string;
  context: VirtualizedSSRContext;
  logFn?: (...args: any[]) => void;
  shouldRewriteBareImports: boolean;
}): Promise<MagicString | null> {
  const filePath = getRealPathFromSSRNamespace(id);

  logFn?.("[rewriteSSRClientImports] called for id: **id** ==> %s", id);
  const imports = findImportSpecifiers(
    id,
    code,
    IGNORED_IMPORT_PATTERNS,
    logFn,
  );
  logFn?.(
    "[rewriteSSRClientImports] Found %d imports in **id** ==> %s",
    imports.length,
    id,
  );
  const ms = new MagicString(code);

  let modified = false;

  for (const i of imports) {
    const raw = i.raw;
    logFn?.(
      "[rewriteSSRClientImports] Processing import '%s' at [%d, %d] in **id** ==> %s",
      raw,
      i.s,
      i.e,
      id,
    );

    if (raw.startsWith(SSR_NAMESPACE)) {
      logFn?.(
        "[rewriteSSRClientImports] Skipping already-virtual import: **import** ==> %s",
        raw,
      );
      continue;
    }

    let virtualId: string | null = null;

    if (isBareImport(raw)) {
      if (shouldRewriteBareImports) {
        virtualId = ensureSSRNamespace(raw);
        logFn?.(
          "[rewriteSSRClientImports] Rewriting bare import **import** ==> '%s' to virtual id **virtualId** ==> '%s' (shouldRewriteBareImports: %s)",
          raw,
          virtualId,
          shouldRewriteBareImports,
        );
      } else {
        const ssrResolved = context.resolveDep(raw);

        if (ssrResolved !== false) {
          virtualId = ensureSSRNamespace(ssrResolved);
          logFn?.(
            "[rewriteSSRClientImports] SSR resolver succeeded for bare import **import** ==> '%s', rewriting to **ssrResolved** ==> '%s'",
            raw,
            virtualId,
          );
        }
      }
    }

    if (virtualId === null) {
      const moduleResolved = await context.resolveModule(raw, filePath);

      if (moduleResolved) {
        virtualId = ensureSSRNamespace(moduleResolved);
        logFn?.(
          "[rewriteSSRClientImports] Module resolver succeeded for import **import** ==> '%s' from **id** ==> %s, rewriting to **moduleResolved** ==> '%s'",
          raw,
          id,
          virtualId,
        );
      } else {
        logFn?.(
          "[rewriteSSRClientImports] Module resolver failed for import **import** ==> '%s' from **id** ==> %s, leaving as is",
          raw,
          id,
        );
      }
    }

    if (virtualId !== null) {
      ms.overwrite(i.s, i.e, virtualId);
      logFn?.(
        "[rewriteSSRClientImports] Rewrote import **import** ==> '%s' to **virtualId** ==> '%s' in **id** ==> %s",
        raw,
        virtualId,
        id,
      );
      modified = true;
    }
  }

  if (modified) {
    logFn?.(
      "[rewriteSSRClientImports] Rewriting complete for **id** ==> %s",
      id,
    );
    return ms;
  } else {
    logFn?.("[rewriteSSRClientImports] No changes made for **id** ==> %s", id);
    return null;
  }
}

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
  if (id.includes("__rwsdkssr")) {
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

async function maybeRewriteSSRClientImports({
  code,
  id,
  shouldRewriteBareImports,
  context,
  logFn,
}: {
  code: string;
  id: string;
  context: VirtualizedSSRContext;
  shouldRewriteBareImports: boolean;
  logFn: (...args: any[]) => void;
}) {
  logFn(`[maybeRewriteSSRClientImports] Rewriting imports for %s`, id);
  const rewritten = await rewriteSSRClientImports({
    code,
    id,
    context,
    logFn,
    shouldRewriteBareImports,
  });
  if (rewritten) {
    return rewritten.toString();
  } else {
    logFn(`[maybeRewriteSSRClientImports] No rewrite needed for %s`, id);
  }
}

export const getRealPathFromSSRNamespace = (filePath: string): string => {
  return filePath.startsWith(SSR_NAMESPACE_PREFIX)
    ? filePath.slice(SSR_NAMESPACE_PREFIX.length)
    : filePath;
};

export const ensureSSRNamespace = (filePath: string) => {
  return SSR_NAMESPACE_PREFIX + getRealPathFromSSRNamespace(filePath);
};

function detectLoader(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".tsx" || ext === ".jsx" ? "tsx" : ext === ".ts" ? "ts" : "js";
}

async function esbuildLoadAndTransformClientModule({
  filePath,
  context,
  logFn,
}: {
  filePath: string;
  context: VirtualizedSSRContext;
  logFn: (...args: any[]) => void;
}) {
  const realPath = getRealPathFromSSRNamespace(filePath);

  let inputCode: string;
  try {
    inputCode = await fs.readFile(realPath, "utf-8");
  } catch (err) {
    logFn("❌ Failed to read file: %s", realPath);
    return undefined;
  }
  const isClient = isClientModule({
    id: filePath,
    code: inputCode,
    logFn,
    esbuild: true,
  });

  if (
    !isClientModule({
      id: filePath,
      code: inputCode,
      logFn,
      esbuild: true,
    })
  ) {
    logFn(
      "⏭️ Skipping non-client module %s, returning undefined so that esbuild will handle it",
      filePath,
    );

    return undefined;
  }

  const rewritten = await maybeRewriteSSRClientImports({
    code: inputCode,
    id: filePath,
    context,
    logFn,
    shouldRewriteBareImports: false,
  });

  let code: string = inputCode;
  let modified: boolean = false;

  if (rewritten) {
    logFn("🔎 Import rewriting complete for %s", filePath);
    code = rewritten;
    modified = true;
  } else {
    logFn("⏭️ No import rewriting needed for %s", filePath);
    code = inputCode;
  }

  const clientResult = await transformClientComponents(code, filePath, {
    environmentName: "worker",
    isEsbuild: true,
  });

  if (clientResult) {
    logFn("🔎 Client component transform complete for %s", filePath);
    code = clientResult.code;
    modified = true;
  } else {
    logFn("⏭️ No client component transform needed for %s", filePath);
  }

  const serverResult = await transformServerReferences(code, filePath, {
    environmentName: "worker",
    isEsbuild: true,
    importSSR: true,
    topLevelRoot: context.projectRootDir,
  });

  if (serverResult) {
    logFn("🔎 Server reference transform complete for %s", filePath);
    code = serverResult.code;
    modified = true;
  } else {
    logFn("⏭️ No server reference transform needed for %s", filePath);
  }

  if (!modified) {
    logFn("⏭️ Returning code unmodified for client module %s", filePath);
  } else {
    logFn("🔎 Returning modified code for client module %s", filePath);
    if (process.env.VERBOSE) {
      logFn(
        "[VERBOSE] Code for modified client module %s:\n%s",
        filePath,
        code,
      );
    }
  }

  return {
    contents: code,
    loader: detectLoader(filePath),
    resolveDir: path.dirname(realPath),
  };
}

function virtualizedSSREsbuildPlugin(context: VirtualizedSSRContext) {
  return {
    name: "virtualized-ssr-esbuild-plugin",
    setup(build: any) {
      build.onResolve(
        { filter: /.*/, namespace: SSR_ESBUILD_NAMESPACE },
        (args: any) => {
          logEsbuild(
            "[esbuild:onResolve:namespace] called with args: %O",
            args,
          );
          return {
            path: ensureSSRNamespace(args.path),
            namespace: SSR_ESBUILD_NAMESPACE,
          };
        },
      );

      build.onLoad(
        { filter: /.*/, namespace: SSR_ESBUILD_NAMESPACE },
        async (args: any) => {
          logEsbuild("[esbuild:onLoad:namespace] called with args: %O", args);
          return esbuildLoadAndTransformClientModule({
            filePath: args.path,
            context,
            logFn: logEsbuildTransform,
          });
        },
      );

      build.onResolve({ filter: /^virtual:rwsdk:ssr:/ }, (args: any) => {
        logEsbuild("[esbuild:onResolve:prefix] called with args: %O", args);
        return {
          path: ensureSSRNamespace(args.path),
          namespace: SSR_ESBUILD_NAMESPACE,
        };
      });

      build.onLoad(
        { filter: /\.(js|jsx|ts|tsx|mjs|mts)$/ },
        async (args: any) => {
          logEsbuild("[esbuild:onLoad:entry] called with args: %O", args);
          const result = await esbuildLoadAndTransformClientModule({
            filePath: args.path,
            context,
            logFn: logEsbuildTransform,
          });
          if (process.env.VERBOSE) {
            logEsbuild("[esbuild:onLoad:entry] result: %O", result);
          }
          return result;
        },
      );
    },
  };
}

function ensureConfigArrays(config: any) {
  config.optimizeDeps ??= {};
  config.optimizeDeps.include ??= [];
  config.optimizeDeps.esbuildOptions ??= {};
  config.optimizeDeps.esbuildOptions.plugins ??= [];
  config.resolve ??= {};
  (config.resolve as any).alias ??= [];
  if (!Array.isArray((config.resolve as any).alias)) {
    const aliasObj = (config.resolve as any).alias;
    (config.resolve as any).alias = Object.entries(aliasObj).map(
      ([find, replacement]) => ({ find, replacement }),
    );
  }
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
    config: undefined,
    resolveModule: () => false,
    resolveDep: () => false,
  };

  return {
    name: "rwsdk:virtualized-ssr",

    async configEnvironment(env, config) {
      logInfo("⚙️ Configuring environment: %s", env);

      if (env !== "worker") {
        logInfo("⏭️ Skipping non-worker environment");
        return;
      }

      ensureConfigArrays(config);

      context.resolveModule = createModuleResolver({
        getAliases: () => getAliases(config.resolve ?? {}),
        roots: [projectRootDir],
        name: "resolveModule",
        conditionNames: SSR_RESOLVER_CONDITION_NAMES,
      });

      context.resolveDep = createSSRDepResolver({
        projectRootDir,
      });

      logInfo("⚙️ Setting up aliases for worker environment");
      logInfo("📊 Configuration state:");
      logInfo("   - Project root: %s", projectRootDir);
      logInfo("   - Virtual SSR namespace: %s", SSR_NAMESPACE);

      (config.optimizeDeps as any).esbuildOptions.plugins = (
        config.optimizeDeps as any
      ).esbuildOptions.plugins.filter(
        (p: any) => p?.name !== "virtualized-ssr-esbuild-plugin",
      );
      (config.optimizeDeps as any).esbuildOptions.plugins.unshift(
        virtualizedSSREsbuildPlugin(context),
      );

      logInfo(
        "✅ Updated Vite config to use only esbuild plugin for SSR virtual deps",
      );

      context.config = config;
    },

    resolveId(id) {
      if (id.startsWith(SSR_NAMESPACE)) {
        if (isBareImport(getRealPathFromSSRNamespace(id))) {
          logResolve("[plugin:resolveId] bare import, returning as is: %s", id);
          return id;
        } else {
          logResolve(
            "[plugin:resolveId] virtualized SSR module, returning real path: %s -> %s",
            id,
            getRealPathFromSSRNamespace(id),
          );
          return getRealPathFromSSRNamespace(id);
        }
      }
    },

    load(id) {
      logResolve("[plugin:load] called with id: %s", id);

      if (!id.startsWith(SSR_NAMESPACE)) {
        return null;
      }

      const moduleId = getRealPathFromSSRNamespace(id);

      try {
        logResolve(
          "📄 load() reading file as separate SSR module: %s",
          moduleId,
        );
        return fs.readFile(moduleId, "utf-8");
      } catch {
        logResolve("❌ load() read failed for: %s", moduleId);
        return null;
      }
    },

    async transform(code, id) {
      logTransform("[plugin:transform] called with id: %s", id);

      if (this.environment.name !== "worker") {
        return null;
      }

      logTransform("📝 Transform: %s", id);

      const isClient = isClientModule({
        id,
        code,
        logFn: logTransform,
        esbuild: false,
      });

      if (!isClient) {
        logTransform("⏭️ Skipping non-client module: %s", id);
        return null;
      }

      logTransform("🔎 Processing imports in client module: %s", id);

      const rewritten = await maybeRewriteSSRClientImports({
        code,
        id,
        context,
        logFn: logTransform,
        shouldRewriteBareImports: false,
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

function getAliases(
  resolveConfig: any,
): Array<{ find: string | RegExp; replacement: string }> {
  if (!resolveConfig?.alias) return [];
  const alias = resolveConfig.alias;
  if (Array.isArray(alias)) {
    return alias;
  }
  // Convert object form to array, ensuring replacement is a string
  return Object.entries(alias).map(([find, replacement]) => ({
    find,
    replacement: String(replacement),
  }));
}
