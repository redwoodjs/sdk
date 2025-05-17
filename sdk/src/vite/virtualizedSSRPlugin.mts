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
import { transformClientComponents } from "./transformClientComponents.mjs";

// context(justinvdm, 2025-05-17): We have esbuild via vite, would like to use the same version for
// compatibility/consistency
// @ts-ignore:
import esbuild from "esbuild";

export const SSR_NAMESPACE = "virtual:rwsdk:ssr";
export const SSR_NAMESPACE_PREFIX = SSR_NAMESPACE + ":";

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

const baseSSRResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

const ssrResolver = (request: string, importer: string): string | false => {
  try {
    return baseSSRResolver(path.dirname(importer), request);
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

function appendNamedExportsForCJSExportDefault(code: string): string {
  if (!code.includes("export default require_")) {
    return code;
  }

  const root = sgParse(SgLang.JavaScript, code).root();

  const exportAssignPattern = "exports.$NAME = $VAL";
  const exportNames = new Set<string>();
  for (const match of root.findAll(exportAssignPattern)) {
    const nameCap = match.getMatch("NAME");
    if (nameCap) {
      exportNames.add(nameCap.text());
    }
  }

  const exportDefaultPattern = "export default $DEF";
  const defaultExportMatch = root.find(exportDefaultPattern);
  if (!defaultExportMatch) {
    return code;
  }

  let appended = "";

  const defaultIdentifierCapture = defaultExportMatch.getMatch("DEF");

  const defaultIdentifier = defaultIdentifierCapture
    ? defaultIdentifierCapture.text()
    : null;

  if (!defaultIdentifier) {
    return code;
  }

  for (const name of exportNames) {
    const exportConstPattern = `export const ${name} =`;
    if (!code.includes(exportConstPattern)) {
      appended += `\nexport const ${name} = ${defaultIdentifier}.${name};`;
    }
  }

  return code + appended;
}

export type VirtualizedSSRContext = {
  projectRootDir: string;
  resolveModule: (
    from: string,
    request: string,
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
}: {
  code: string;
  id: string;
  context: VirtualizedSSRContext;
  logFn?: (...args: any[]) => void;
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
      const ssrResolved = context.resolveDep(raw);

      if (ssrResolved !== false) {
        logFn?.(
          "[rewriteSSRClientImports] SSR resolver succeeded for bare import '%s', rewriting to '%s'",
          raw,
          ssrResolved,
        );
        virtualId = SSR_NAMESPACE_PREFIX + ssrResolved;
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
        virtualId = SSR_NAMESPACE_PREFIX + moduleResolved;
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
  logFn?.(
    "[maybeRewriteSSRClientImports] Called for id: %s (startsWith SSR_NAMESPACE: %s)",
    id,
    id.startsWith(SSR_NAMESPACE),
  );
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

export const getRealPath = (filePath: string) => {
  return filePath.startsWith(SSR_NAMESPACE_PREFIX)
    ? filePath.slice(SSR_NAMESPACE_PREFIX.length)
    : filePath;
};

function detectLoader(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".tsx" || ext === ".jsx" ? "tsx" : ext === ".ts" ? "ts" : "js";
}

async function convertCJSToESM({
  filePath,
  code: inputCode,
}: {
  filePath: string;
  code: string;
}) {
  const loader = detectLoader(filePath);

  let { code } = await esbuild.transform(inputCode, {
    loader: detectLoader(filePath),
    format: "esm",
    target: "esnext",
    sourcefile: filePath,
    sourcemap: false,
  });

  code = appendNamedExportsForCJSExportDefault(code as string);

  return {
    code,
    loader,
  };
}

async function loadAndTransformClientModule({
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
  const rewritten = await maybeRewriteSSRClientImports({
    code: inputCode,
    id: filePath,
    context,
    logFn,
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

  if (!modified) {
    logFn("⏭️ No changes made for %s", filePath);
    return undefined;
  }

  logFn("🔎 Changes made, converting CJS to ESM for %s", filePath);

  const { code: transformedCode, loader } = await convertCJSToESM({
    filePath,
    code,
  });

  return {
    contents: transformedCode,
    loader,
    resolveDir: path.dirname(realPath),
  };
}

function virtualizedSSREsbuildPlugin(context: VirtualizedSSRContext) {
  return {
    name: "virtualized-ssr-esbuild-plugin",
    setup(build: any) {
      build.onResolve({ filter: /^virtual:rwsdk:ssr:/ }, (args: any) => {
        logEsbuild("[esbuild:onResolve:ssr] called with args: %O", args);
        return {
          path: getRealPath(args.path),
          //namespace: SSR_NAMESPACE,
        };
      });

      //build.onResolve(
      //  { filter: /.*/, namespace: SSR_NAMESPACE },
      //  (args: any) => {
      //    logEsbuild(
      //      "[esbuild:onResolve:ssr-namespace] called with args: %O",
      //      args,
      //    );
      //    return {
      //      path: getRealPath(args.path),
      //      namespace: SSR_NAMESPACE,
      //    };
      //  },
      //);

      build.onLoad({ filter: /^virtual:rwsdk:ssr:/ }, async (args: any) => {
        logEsbuild(
          "[esbuild:onLoad:ssr] [esbuild:onLoad:module] called with args: %O",
          args,
        );
        return loadAndTransformClientModule({
          filePath: args.path,
          context,
          logFn: logEsbuildTransform,
        });
      });

      //build.onLoad(
      //  { filter: /.*/, namespace: SSR_NAMESPACE },
      //  async (args: any) => {
      //    logEsbuild(
      //      "[esbuild:onLoad:ssr-namespace] [esbuild:onLoad:module] called with args: %O",
      //      args,
      //    );
      //    return loadAndTransformClientModule({
      //      filePath: SSR_NAMESPACE_PREFIX + args.path,
      //      context,
      //      logFn: logEsbuildTransform,
      //    });
      //  },
      //);

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

    resolveId(id, importer) {
      if (id.startsWith(SSR_NAMESPACE)) {
        if (id.includes("node_modules")) {
          const filePath = getRealPath(id);
          logResolve(
            "[plugin:resolveId] virtualized SSR dependency, returning real path: %s, importer: %s",
            filePath,
            importer,
          );
          return filePath;
        } else {
          logResolve(
            "[plugin:resolveId] virtualized SSR module, returning as is: %s, importer: %s",
            id,
          );
          return id;
        }
      }
    },

    load(id) {
      logResolve("[plugin:load] called with id: %s", id);
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
      logTransform("[plugin:transform] called with id: %s", id);

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
