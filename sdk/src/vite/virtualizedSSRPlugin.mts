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
import { createAliasedSSRResolver } from "./aliasedSSRResolver.mjs";
import MagicString from "magic-string";
import debug from "debug";
import { parse as sgParse, Lang as SgLang } from "@ast-grep/napi";
import { ROOT_DIR } from "../lib/constants.mjs";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { glob } from "glob";
import { transformServerReferences } from "./transformServerReferences.mjs";

export const SSR_NAMESPACE = "virtual:rwsdk:ssr";
export const SSR_NAMESPACE_PREFIX = SSR_NAMESPACE + ":";

export const SSR_ESBUILD_NAMESPACE = "__rwsdk_ssr_esbuild_namespace__";

const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");

const logEsbuild = debug("rwsdk:vite:virtualized-ssr:esbuild");
const logEsbuildTransform = logEsbuild.extend("transform");

const IGNORED_IMPORT_PATTERNS = [
  /^cloudflare:.*$/,
  /^react\/jsx-runtime$/,
  /^react\/jsx-dev-runtime$/,
];

const IMPORT_PATTERNS = [
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

const createSSRDepResolver = ({
  projectRootDir,
  getResolveConfig,
}: {
  projectRootDir: string;
  getResolveConfig: () => any;
}) => {
  const resolver = createAliasedSSRResolver({
    getResolveConfig,
    roots: [projectRootDir, ROOT_DIR],
    name: "resolveDep",
  });
  return (request: string): string | false => resolver(request, "/");
};

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
            const importPath = moduleCapture.text();
            if (
              !importPath.startsWith("virtual:") &&
              !IGNORED_IMPORT_PATTERNS.some((pattern) =>
                pattern.test(importPath),
              )
            ) {
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
  const filePath = getRealPath(id);

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

    if (raw.startsWith(SSR_NAMESPACE)) {
      logFn?.(
        "[rewriteSSRClientImports] Skipping already-virtual import: %s",
        raw,
      );
      continue;
    }

    let virtualId: string | null = null;

    if (isBareImport(raw)) {
      if (shouldRewriteBareImports) {
        logFn?.(
          "[rewriteSSRClientImports] Rewriting bare import '%s' to virtual id '%s' (shouldRewriteBareImports: %s)",
          raw,
          ensureNamespace(raw),
        );
        virtualId = ensureNamespace(raw);
      } else {
        const ssrResolved = context.resolveDep(raw);

        if (ssrResolved !== false) {
          logFn?.(
            "[rewriteSSRClientImports] SSR resolver succeeded for bare import '%s', rewriting to '%s'",
            raw,
            ssrResolved,
          );
          virtualId = ensureNamespace(ssrResolved);
        }
      }
    }

    if (virtualId === null) {
      const moduleResolved = await context.resolveModule(raw, filePath);

      if (moduleResolved) {
        logFn?.(
          "[rewriteSSRClientImports] Module resolver succeeded for import '%s' from %s, rewriting to '%s'",
          raw,
          id,
          moduleResolved,
        );
        virtualId = ensureNamespace(moduleResolved);
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
      logFn?.(
        "[rewriteSSRClientImports] Rewrote import '%s' to '%s' in %s",
        raw,
        virtualId,
        id,
      );
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
  isClient,
  shouldRewriteBareImports,
  context,
  logFn,
}: {
  code: string;
  id: string;
  isClient: boolean;
  context: VirtualizedSSRContext;
  shouldRewriteBareImports: boolean;
  logFn: (...args: any[]) => void;
}) {
  logFn?.(
    "[maybeRewriteSSRClientImports] Called for id: %s (startsWith SSR_NAMESPACE: %s)",
    id,
    id.startsWith(SSR_NAMESPACE),
  );
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
      shouldRewriteBareImports,
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

export const getRealPath = (filePath: string): string => {
  return filePath.startsWith(SSR_NAMESPACE_PREFIX)
    ? filePath.slice(SSR_NAMESPACE_PREFIX.length)
    : filePath;
};

export const ensureNamespace = (filePath: string) => {
  return SSR_NAMESPACE_PREFIX + getRealPath(filePath);
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
  const realPath = getRealPath(filePath);

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

  const rewritten = await maybeRewriteSSRClientImports({
    code: inputCode,
    id: filePath,
    isClient,
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

  // --- Server reference transform for SSR ---
  if (isClient) {
    const serverResult = await transformServerReferences(code, realPath, {
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
  }

  if (!modified) {
    logFn("⏭️ No changes made for %s", filePath);
    if (!isClient) {
      logFn(
        "⏭️ No changes made for non-client module %s, returning undefined so that esbuild will handle it",
        filePath,
      );
      return undefined;
    } else {
      logFn("🔎 Returning code unmodified for client module %s", filePath);
      return {
        contents: code,
        loader: detectLoader(filePath),
      };
    }
  }

  logFn("🔎 Returning modified code for client module %s", filePath);

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
            path: args.path,
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
          path: args.path,
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

async function scanForBareImports({
  projectRootDir,
  logInfo,
  findImportSpecifiersWithPositions,
  isBareImport,
}: {
  projectRootDir: string;
  logInfo: (...args: any[]) => void;
  findImportSpecifiersWithPositions: (
    code: string,
    lang: any,
  ) => Array<{ s: number; e: number; raw: string }>;
  isBareImport: (importPath: string) => boolean;
}): Promise<Set<string>> {
  const globPattern = "src/**/*.{ts,tsx,js,jsx}";
  let bareImports = new Set<string>();
  try {
    const files = await glob(globPattern, {
      cwd: projectRootDir,
      absolute: true,
    });
    for (const file of files) {
      const filePath = file as string;
      let code;
      try {
        code = await fs.readFile(filePath, "utf-8");
      } catch (err) {
        logInfo("❌ Failed to read file during scan: %s", filePath);
        continue;
      }
      const ext = path.extname(filePath).toLowerCase();
      const lang =
        ext === ".tsx" || ext === ".jsx" ? SgLang.Tsx : SgLang.TypeScript;
      const imports = findImportSpecifiersWithPositions(code, lang);
      for (const i of imports) {
        if (isBareImport(i.raw)) {
          bareImports.add(i.raw);
        }
      }
    }
    logInfo("🔎 Initial scan found %d unique bare imports:", bareImports.size);
    for (const imp of bareImports) {
      logInfo("   - %s", imp);
    }
  } catch (err) {
    logInfo("❌ Error during initial scan for bare imports: %O", err);
  }
  return bareImports;
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

      const bareImports = await scanForBareImports({
        projectRootDir,
        logInfo,
        findImportSpecifiersWithPositions,
        isBareImport,
      });

      ensureConfigArrays(config);

      const getResolveConfig = () => config.resolve ?? {};

      context.resolveModule = createAliasedSSRResolver({
        getResolveConfig,
        roots: [projectRootDir],
        name: "resolveModule",
      });

      context.resolveDep = createSSRDepResolver({
        getResolveConfig,
        projectRootDir,
      });

      for (const importPath of bareImports) {
        const resolved = context.resolveDep(importPath);
        if (resolved && typeof resolved === "string") {
          if (!(config.optimizeDeps as any).include.includes(importPath)) {
            (config.optimizeDeps as any).include.push(importPath);
          }
          (config.resolve as any).alias.unshift({
            find: importPath,
            replacement: SSR_NAMESPACE_PREFIX + resolved,
          });
        }
      }

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
        if (isBareImport(getRealPath(id))) {
          logResolve("[plugin:resolveId] bare import, returning as is: %s", id);
          return id;
        } else {
          logResolve(
            "[plugin:resolveId] virtualized SSR module, returning real path: %s",
            id,
          );
          return getRealPath(id);
        }
      }
    },

    load(id) {
      logResolve("[plugin:load] called with id: %s", id);

      if (!id.startsWith(SSR_NAMESPACE)) {
        return null;
      }

      const moduleId = getRealPath(id);

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
        isClient,
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
