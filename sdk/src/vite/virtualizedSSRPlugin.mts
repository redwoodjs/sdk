/**
 * context(justinvdm, 2025-05-14):
 *
 * ## Problem
 * React Server Components (RSC) and traditional SSR require different module resolution:
 * - RSC modules must resolve with the "react-server" export condition
 * - SSR modules must resolve without it
 *
 * This presents a challenge in projects like ours, where the same modules
 * often need to run in both modes — within a single Cloudflare Worker runtime.
 * We can't split execution contexts or afford duplicated builds.
 *
 * Vite provides an elegant way to manage distinct resolution graphs via its
 * `environments` feature (`client`, `ssr`, `worker`, etc.). Each environment
 * can use different export conditions, plugins, and optimizeDeps configs.
 *
 * However, using separate environments implies separate output bundles.
 * In our case, that would nearly double the final bundle size — which is not
 * viable given Cloudflare Workers' strict 3MB limit.
 *
 * ## Solution
 * We run both RSC and SSR from a single Vite `worker` environment.
 * To simulate distinct resolution graphs, we virtualize SSR imports using a prefix.
 *
 * How it works:
 * - Any module beginning with `"use client"` is treated as an SSR boundary.
 * - All of its dependencies — and their transitive imports — must be resolved
 *   without the `"react-server"` condition.
 *
 * To do this:
 * - We eagerly resolve all declared `dependencies` and their subpaths via enhanced-resolve,
 *   storing them as virtual aliases like `virtual:rwsdk:ssr:react` or `virtual:rwsdk:ssr:swr/infinite`.
 * - In the transform step, we use es-module-lexer to detect import statements in modules
 *   that are part of the SSR graph. If the import is in `depPrefixMap`, we rewrite it to the
 *   virtual ID using MagicString.
 * - At build start (`configEnvironment`), we register all these virtual IDs as Vite aliases
 *   pointing to their resolved SSR paths.
 * - Vite then resolves and optimizes them as if they were real modules, without `"react-server"`.
 *
 * We use our own custom module graph to track imports originating from "use client" modules
 * instead of relying on Vite's module graph. This gives us more control and better visibility
 * into the dependency relationships.
 */

import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";
import enhancedResolve from "enhanced-resolve";
import { init, parse } from "es-module-lexer";
import MagicString from "magic-string";
import debug from "debug";

const SSR_NAMESPACE = "virtual:rwsdk:ssr:";
const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logTrace = log.extend("trace");
const logGraph = log.extend("graph");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");

const ssrResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

/**
 * Custom module graph to track dependencies
 */
class SSRModuleGraph {
  private clientModules = new Set<string>();
  private moduleImports = new Map<string, Set<string>>();
  private moduleImporters = new Map<string, Set<string>>();

  constructor() {
    logGraph("📊 Creating custom SSR module graph");
  }

  addClientModule(id: string): void {
    logGraph("📝 Adding client module: %s", id);
    this.clientModules.add(id);
  }

  isClientModule(id: string): boolean {
    return this.clientModules.has(id);
  }

  addImport(importerId: string, importedId: string): void {
    logGraph("🔗 Adding import relationship: %s -> %s", importerId, importedId);

    // Track what this module imports
    if (!this.moduleImports.has(importerId)) {
      this.moduleImports.set(importerId, new Set());
    }
    this.moduleImports.get(importerId)!.add(importedId);

    // Track what imports this module
    if (!this.moduleImporters.has(importedId)) {
      this.moduleImporters.set(importedId, new Set());
    }
    this.moduleImporters.get(importedId)!.add(importerId);
  }

  getImporters(id: string): Set<string> {
    return this.moduleImporters.get(id) || new Set();
  }

  getImports(id: string): Set<string> {
    return this.moduleImports.get(id) || new Set();
  }

  isInClientTree(id: string, visited = new Set<string>()): boolean {
    // Avoid circular dependencies
    if (visited.has(id)) return false;
    visited.add(id);

    // Direct client module
    if (this.isClientModule(id)) {
      logGraph("🎯 %s is a direct client module", id);
      return true;
    }

    // Check if any importers are in client tree
    const importers = this.getImporters(id);
    if (importers.size === 0) {
      logGraph("❌ %s has no importers, not in client tree", id);
      return false;
    }

    for (const importer of importers) {
      if (this.isInClientTree(importer, visited)) {
        logGraph("✅ %s is in client tree via %s", id, importer);
        return true;
      }
    }

    logGraph("❌ %s is not in client tree", id);
    return false;
  }

  debug(): void {
    logGraph("📊 Module Graph Status:");
    logGraph("Client Modules: %d", this.clientModules.size);
    logGraph("Module Import Records: %d", this.moduleImports.size);
    logGraph("Module Importer Records: %d", this.moduleImporters.size);

    logGraph("Client Modules:");
    for (const mod of this.clientModules) {
      logGraph(" - %s", mod);
    }
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

  const moduleGraph = new SSRModuleGraph();
  const virtualSsrDeps = new Map<string, string>();
  const depPrefixMap = new Map<string, string>();
  const resolvedIds = new Map<string, string>();

  async function resolvePackageDeps(dep: string): Promise<Map<string, string>> {
    logResolve("🔍 Resolving package dependencies for: %s", dep);

    const mappings = new Map<string, string>();
    try {
      const entry = ssrResolver(projectRootDir, dep);

      if (!entry) {
        logResolve("⚠️ Could not resolve entry for %s", dep);
        return mappings;
      }

      logResolve("✅ Resolved entry for %s: %s", dep, entry);

      // Find the root package.json
      let dir = path.dirname(entry);
      while (dir !== projectRootDir) {
        const pkgJsonPath = path.join(dir, "package.json");
        logResolve("📦 Looking for package.json at: %s", pkgJsonPath);

        try {
          await fs.access(pkgJsonPath);
          const raw = await fs.readFile(pkgJsonPath, "utf-8");
          const pkg = JSON.parse(raw);
          logResolve("📦 Found package.json for %s", dep);

          // Resolve root entry
          const virtualId = SSR_NAMESPACE + dep;
          mappings.set(virtualId, entry);
          logResolve("➕ Mapping %s -> %s", virtualId, entry);

          // Track rewrite mapping
          depPrefixMap.set(dep, virtualId);
          logResolve("📝 Added rewrite mapping %s -> %s", dep, virtualId);

          // Resolve exports subpaths
          if (typeof pkg.exports === "object" && pkg.exports !== null) {
            logResolve(
              "📦 Processing exports for %s: %O",
              dep,
              Object.keys(pkg.exports),
            );

            for (const key of Object.keys(pkg.exports)) {
              if (!key.startsWith("./") || key === "./package.json") continue;

              const sub = key.slice(2); // './infinite' -> 'infinite'
              const full = `${dep}/${sub}`;

              logResolve("🔍 Resolving subpath %s from %s", "./" + sub, dir);
              const resolved = ssrResolver(dir, "./" + sub);

              const vId = SSR_NAMESPACE + full;
              if (resolved) {
                mappings.set(vId, resolved);
                depPrefixMap.set(full, vId);
                logResolve("➕ Mapping %s -> %s", vId, resolved);
              } else {
                logResolve("⚠️ Failed to resolve %s", "./" + sub);
              }
            }
          } else {
            logResolve("📦 No exports field in package.json for %s", dep);
          }

          break;
        } catch (err) {
          logResolve("⚠️ No package.json at %s, moving up", pkgJsonPath);
          dir = path.dirname(dir);
        }
      }
    } catch (err) {
      logError("❌ Failed to resolve %s: %O", dep, err);
    }

    logResolve("📊 Resolved %d mappings for %s", mappings.size, dep);
    return mappings;
  }

  return {
    name: "rwsdk:virtualized-ssr",

    async configEnvironment(env, config) {
      logInfo("⚙️ Configuring environment: %s", env);

      if (env !== "worker") {
        logInfo("⏭️ Skipping non-worker environment");
        return;
      }

      logInfo("⚙️ Setting up aliases for worker environment");

      config.resolve ??= {};
      (config.resolve as any).alias ??= [];

      if (!Array.isArray((config.resolve as any).alias)) {
        logInfo("⚙️ Converting alias object to array");
        const aliasObj = (config.resolve as any).alias;
        (config.resolve as any).alias = Object.entries(aliasObj).map(
          ([find, replacement]) => ({ find, replacement }),
        );
      }

      const pkgPath = path.join(projectRootDir, "package.json");
      logInfo("📦 Reading package.json from: %s", pkgPath);

      const pkgRaw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgRaw);
      const deps = Object.keys(pkg.dependencies ?? {});
      logInfo("📦 Found %d dependencies", deps.length);

      for (const dep of deps) {
        if (dep === "rwsdk") {
          logInfo("⏭️ Skipping rwsdk package");
          continue;
        }

        logInfo("🔍 Processing dependency: %s", dep);
        const resolved = await resolvePackageDeps(dep);

        for (const [vId, real] of resolved.entries()) {
          virtualSsrDeps.set(vId, real);
          logInfo("➕ Added virtual SSR dep: %s -> %s", vId, real);
        }
      }

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

      logInfo("✅ Registered %d SSR virtual aliases", virtualSsrDeps.size);
    },

    resolveId(source, importer, options) {
      if (!importer) return null;

      logTrace("🔍 resolveId called: %s from %s", source, importer);

      // Record the relationship in our graph when it gets resolved
      const resolvePromise = this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      if (resolvePromise) {
        resolvePromise.then((resolved) => {
          if (resolved) {
            logTrace(
              "🔗 Resolved %s -> %s (from %s)",
              source,
              resolved.id,
              importer,
            );
            moduleGraph.addImport(importer, resolved.id);
            resolvedIds.set(`${importer}:${source}`, resolved.id);
          } else {
            logTrace("⚠️ Failed to resolve %s from %s", source, importer);
          }
        });
      }

      return null; // Let Vite handle the actual resolution
    },

    async transform(code, id, options) {
      logTransform("🔄 Transform: %s", id);

      if (this.environment.name !== "worker") {
        logTransform("⏭️ Skipping non-worker environment for: %s", id);
        return null;
      }

      if (
        id.endsWith(".ts") ||
        id.endsWith(".js") ||
        id.endsWith(".tsx") ||
        id.endsWith(".jsx") ||
        id.endsWith(".mjs")
      ) {
        const firstLine = code.split("\n", 1)[0]?.trim();
        if (firstLine === "'use client'" || firstLine === '"use client"') {
          logTransform("🎯 Found SSR entrypoint: %s", id);
          moduleGraph.addClientModule(id);

          // Debug current graph status periodically
          moduleGraph.debug();
        }
      }

      // Check if this module is in the client tree using our custom graph
      const shouldRewrite = moduleGraph.isInClientTree(id);

      if (!shouldRewrite) {
        logTransform("⏭️ No rewrite needed for: %s", id);
        return null;
      }

      logTransform("✅ Module is in client tree, applying rewrites: %s", id);

      await init;
      const [imports] = parse(code);
      const ms = new MagicString(code);
      let modified = false;

      for (const i of imports) {
        const raw = code.slice(i.s, i.e);
        const prefix = depPrefixMap.get(raw);

        if (prefix) {
          logTransform("🔁 Rewriting %s -> %s in %s", raw, prefix, id);
          ms.overwrite(i.s, i.e, prefix);
          modified = true;
        } else {
          logTransform("⏭️ No rewrite mapping for %s in %s", raw, id);
        }
      }

      if (modified) {
        logTransform("✏️ Modified code in: %s", id);
        return {
          code: ms.toString(),
          map: ms.generateMap({ hires: true }),
        };
      }

      logTransform("⏭️ No modifications made to: %s", id);
      return null;
    },

    buildEnd() {
      logInfo("🏁 Build ended");
      logInfo("📊 Final module graph statistics:");
      moduleGraph.debug();
    },
  };
}
