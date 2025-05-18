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
import { ROOT_DIR, DIST_DIR } from "../lib/constants.mjs";
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

async function resolveSSRPath({
  path,
  importer,
  context,
  logFn,
}: {
  path: string;
  importer: string;
  context: VirtualizedSSRContext;
  logFn?: (...args: any[]) => void;
}): Promise<string> {
  logFn?.(":resolveSSRPath: called with path=%s, importer=%s", path, importer);

  if (!path.startsWith(SSR_NAMESPACE)) {
    logFn?.(":resolveSSRPath: Skipping non-SSR path: path=%s", path);
    return path;
  }

  const raw = getRealPathFromSSRNamespace(path);

  if (isBareImport(raw)) {
    const ssrResolved = context.resolveDep(raw);
    if (ssrResolved !== false) {
      const resolved = ensureSSRNamespace(ssrResolved);
      logFn?.(
        ":resolveSSRPath: SSR resolver succeeded for bare import import='%s', resolved to resolved='%s'",
        path,
        resolved,
      );
      return resolved;
    }
  }

  const moduleResolved = await context.resolveModule(
    raw,
    getRealPathFromSSRNamespace(importer),
  );

  if (moduleResolved) {
    if (moduleResolved.startsWith(DIST_DIR)) {
      if (moduleResolved.includes("__rwsdkssr")) {
        const resolved = ensureSSRNamespace(moduleResolved);
        logFn?.(
          ":resolveSSRPath: Module resolved to an SDK path that contains __rwsdkssr, returning resolved path *with* SSR namespace: moduleResolved=%s",
          moduleResolved,
        );
        return resolved;
      } else {
        logFn?.(
          ":resolveSSRPath: Module resolved to an SDK path, returning resolved path *without* SSR namespace: moduleResolved=%s",
          moduleResolved,
        );
        return moduleResolved;
      }
    }

    const resolved = ensureSSRNamespace(moduleResolved);

    logFn?.(
      ":resolveSSRPath: Module resolver succeeded for import import='%s' from importer=%s, resolved to moduleResolved='%s'",
      raw,
      importer,
      resolved,
    );
    return resolved;
  } else {
    logFn?.(
      ":resolveSSRPath: Module resolver failed for import import='%s' from importer=%s, returning raw path without SSR namespace",
      raw,
      importer,
    );
    return raw;
  }
}

async function rewriteSSRImports({
  code,
  id,
  logFn,
}: {
  code: string;
  id: string;
  context: VirtualizedSSRContext;
  logFn?: (...args: any[]) => void;
}): Promise<MagicString | null> {
  const isSDKPath = getRealPathFromSSRNamespace(id).startsWith(DIST_DIR);

  logFn?.(
    ":rewriteSSRImports: called for id: id=%s, isSDKPath=%s",
    id,
    isSDKPath,
  );
  const imports = findImportSpecifiers(
    id,
    code,
    IGNORED_IMPORT_PATTERNS,
    logFn,
  );

  logFn?.(":rewriteSSRImports: Found %d imports in id=%s", imports.length, id);
  const ms = new MagicString(code);

  let modified = false;

  for (const i of imports) {
    const raw = i.raw;
    logFn?.(
      ":rewriteSSRImports: Processing import '%s' at [%d, %d] in id=%s",
      raw,
      i.s,
      i.e,
      id,
    );

    const realPath = getRealPathFromSSRNamespace(raw);

    if (
      isSDKPath &&
      !isBareImport(realPath) &&
      !path.isAbsolute(realPath) &&
      !realPath.includes("__rwsdkssr")
    ) {
      logFn?.(
        ":rewriteSSRImports: Skipping import because it is a relative import within the SDK: import='%s', in id=%s",
        raw,
        id,
      );
      continue;
    }

    const virtualId = ensureSSRNamespace(raw);
    ms.overwrite(i.s, i.e, virtualId);
    logFn?.(
      ":rewriteSSRImports: Rewrote import import='%s' to virtualId='%s' in id=%s",
      raw,
      virtualId,
      id,
    );
    modified = true;
  }

  if (modified) {
    logFn?.(":rewriteSSRImports: Rewriting complete for id=%s", id);
    return ms;
  } else {
    logFn?.(":rewriteSSRImports: No changes made for id=%s", id);
    return null;
  }
}

function isSSRModule({
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
      ":isSSRModule: Detected SSR module (includes __rwsdk_ssr): id=%s esbuild=%s",
      id,
      !!esbuild,
    );
    return true;
  }
  if (id.startsWith(SSR_NAMESPACE)) {
    logger(
      ":isSSRModule: Detected SSR module (SSR_NAMESPACE): id=%s esbuild=%s",
      id,
      !!esbuild,
    );
    return true;
  }
  return false;
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

async function esbuildResolveSSRModule({
  path,
  context,
  importer,
}: {
  path: string;
  context: VirtualizedSSRContext;
  importer: string;
}) {
  logEsbuild(":esbuildResolveSSRModule: called with path=%s", path);

  const resolved = await resolveSSRPath({
    path,
    importer,
    context,
    logFn: logEsbuild,
  });

  const result: {
    path: string;
    namespace?: string;
    external?: boolean;
  } = {
    path: resolved,
  };

  if (resolved?.startsWith(SSR_NAMESPACE)) {
    result.namespace = SSR_ESBUILD_NAMESPACE;
  } else if (isBareImport(resolved)) {
    result.external = true;
  } else {
    result.namespace = "file";
  }

  logEsbuild(
    ":esbuildResolveSSRModule: resolved result for path=%s: result=%O",
    path,
    result,
  );

  return result;
}

async function esbuildLoadAndTransformSSRModule({
  filePath,
  context,
  logFn,
}: {
  filePath: string;
  context: VirtualizedSSRContext;
  logFn: (...args: any[]) => void;
}) {
  const realPath = getRealPathFromSSRNamespace(filePath);

  if (isBareImport(realPath)) {
    logFn("⏭️ Skipping bare import: %s", realPath);
    return undefined;
  }

  let inputCode: string;
  try {
    inputCode = await fs.readFile(realPath, "utf-8");
  } catch (err) {
    logFn("❌ Failed to read file: %s", realPath);
    return undefined;
  }
  const isSSR = isSSRModule({
    id: filePath,
    code: inputCode,
    logFn,
    esbuild: true,
  });

  let code: string = inputCode;
  let modified: boolean = false;

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
    isSSR,
    topLevelRoot: context.projectRootDir,
  });

  if (serverResult) {
    logFn("🔎 Server reference transform complete for %s", filePath);
    code = serverResult.code;
    modified = true;
  } else {
    logFn("⏭️ No server reference transform needed for %s", filePath);
  }

  if (isSSR) {
    let rewritten = await rewriteSSRImports({
      code: inputCode,
      id: filePath,
      context,
      logFn,
    });
    if (rewritten) {
      logFn("🔎 Import rewriting complete for %s", filePath);
      code = rewritten.toString();
      modified = true;
    } else {
      logFn("⏭️ No import rewriting needed for %s", filePath);
    }
  }

  if (!modified) {
    if (isSSR) {
      logFn("⏭️ Returning code unmodified for SSR module %s", filePath);
    } else {
      logFn("⏭️ Returning code unmodified for non-SSR module %s", filePath);
      return undefined;
    }
  } else {
    logFn("🔎 Returning modified code for %s", filePath);
    if (process.env.VERBOSE) {
      logFn(":VERBOSE: Code for modified %s:\n%s", filePath, code);
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
          logEsbuild(":esbuild:onResolve:namespace called with args: %O", args);

          const result = esbuildResolveSSRModule({
            context,
            path: args.path,
            importer: args.importer,
          });

          logEsbuild(
            ":esbuild:onResolve:namespace resolved result for path=%s: result=%O",
            args.path,
            result,
          );

          return result;
        },
      );

      build.onLoad(
        { filter: /.*/, namespace: SSR_ESBUILD_NAMESPACE },
        async (args: any) => {
          logEsbuild(":esbuild:onLoad:namespace called with args: %O", args);
          return esbuildLoadAndTransformSSRModule({
            filePath: args.path,
            context,
            logFn: logEsbuildTransform,
          });
        },
      );

      build.onResolve({ filter: /^virtual:rwsdk:ssr:/ }, (args: any) => {
        logEsbuild(":esbuild:onResolve:prefix called with args: %O", args);

        const result = esbuildResolveSSRModule({
          context,
          path: args.path,
          importer: args.importer,
        });

        logEsbuild(
          ":esbuild:onResolve:prefix resolved result for path=%s: result=%O",
          args.path,
          result,
        );

        return result;
      });

      build.onLoad(
        { filter: /\.(js|jsx|ts|tsx|mjs|mts)$/ },
        async (args: any) => {
          logEsbuild(":esbuild:onLoad:entry called with args: %O", args);

          const result = await esbuildLoadAndTransformSSRModule({
            filePath: args.path,
            context,
            logFn: logEsbuildTransform,
          });

          if (process.env.VERBOSE) {
            logEsbuild(":esbuild:onLoad:entry result: %O", result);
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
      logInfo(":configEnvironment: Configuring environment: %s", env);

      if (env !== "worker") {
        logInfo(":configEnvironment: Skipping non-worker environment");
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

      logInfo(":configEnvironment: Setting up aliases for worker environment");
      logInfo(":configEnvironment: Configuration state:");
      logInfo(":configEnvironment:    - Project root: %s", projectRootDir);
      logInfo(
        ":configEnvironment:    - Virtual SSR namespace: %s",
        SSR_NAMESPACE,
      );

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

    async resolveId(id) {
      logResolve(":plugin:resolveId: called with id: %s", id);

      if (!id.startsWith(SSR_NAMESPACE)) {
        logResolve(":plugin:resolveId: Skipping non-SSR namespace: %s", id);
        return id;
      }

      const realPath = getRealPathFromSSRNamespace(id);

      if (isBareImport(realPath)) {
        logResolve(":plugin:resolveId: Found bare import, returning as is: %s");
        return {
          id: realPath,
          external: true,
        };
      }

      const result = await resolveSSRPath({
        path: realPath,
        importer: id,
        context,
        logFn: logResolve,
      });

      logResolve(
        ":plugin:resolveId: resolved result for id=%s: result=%O",
        id,
        result,
      );

      return result;
    },

    load(id) {
      logResolve(":plugin:load: called with id: %s", id);

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
      logTransform(":plugin:transform: called with id: %s", id);

      if (this.environment.name !== "worker") {
        return null;
      }

      logTransform("📝 Transform: %s", id);

      const isSSR = isSSRModule({
        id,
        code,
        logFn: logTransform,
        esbuild: false,
      });

      if (!isSSR) {
        logTransform("⏭️ Skipping non-SSR module: %s", id);
        return null;
      }

      logTransform("🔎 Processing imports in SSR module: %s", id);

      const rewritten = await rewriteSSRImports({
        code,
        id,
        context,
        logFn: logTransform,
      });

      if (!rewritten) {
        logTransform("⏭️ No changes made for %s", id);
        return null;
      } else {
        logTransform("🔎 Rewrote imports for %s", id);
        if (process.env.VERBOSE) {
          logTransform(
            ":VERBOSE: Rewritten code for %s:\n%s",
            id,
            rewritten.toString(),
          );
        }
      }

      return {
        code: rewritten.toString(),
        map: rewritten.generateMap(),
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
