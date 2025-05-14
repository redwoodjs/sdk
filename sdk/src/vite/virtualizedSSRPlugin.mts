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
 * - When we encounter a "use client" module in transform:
 *   - For each import, we check if it's a dependency from our mapping
 *   - If it's a dependency, we prefix it with our virtual namespace
 *   - If not, we resolve it on-the-fly and prefix non-node_modules imports
 * - In load(), we intercept prefixed modules, strip the prefix, and apply the same logic
 *   to its imports recursively
 *
 * This approach eliminates the need for tracking a custom module graph, making the
 * process more direct and following Vite's plugin lifecycle more naturally.
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
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");
const logLoad = log.extend("load");

const ssrResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

export function virtualizedSSRPlugin({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin {
  logInfo(
    "🚀 Initializing VirtualizedSSR plugin with root: %s",
    projectRootDir,
  );

  const virtualSsrDeps = new Map<string, string>();
  const depPrefixMap = new Map<string, string>();

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

  // Helper function to check if a path is in node_modules
  function isDep(id: string): boolean {
    return id.includes("node_modules") || id.includes(".vite");
  }

  // Helper function to process imports in a code string
  async function processImports(
    context: any,
    code: string,
    id: string,
    isClientModule: boolean,
  ): Promise<{ code: string; map: any } | null> {
    if (!isClientModule) {
      return null;
    }

    await init;
    const [imports] = parse(code);
    const ms = new MagicString(code);
    let modified = false;

    for (const i of imports) {
      const raw = code.slice(i.s, i.e);
      // Check if it's in our known deps mapping
      const prefix = depPrefixMap.get(raw);

      if (prefix) {
        logTransform("🔁 Rewriting %s -> %s in %s", raw, prefix, id);
        ms.overwrite(i.s, i.e, prefix);
        modified = true;
      } else {
        // Not in our mapping, use context.resolve() to check if it's a non-node_modules import
        try {
          const resolved = await context.resolve(raw, id);
          if (resolved && !isDep(resolved.id)) {
            const virtualId = SSR_NAMESPACE + raw;
            logTransform(
              "🔁 Rewriting non-node_modules import %s -> %s in %s",
              raw,
              virtualId,
              id,
            );
            ms.overwrite(i.s, i.e, virtualId);
            modified = true;
          }
        } catch (err) {
          logError("❌ Failed to resolve %s from %s: %O", raw, id, err);
        }
      }
    }

    if (modified) {
      logTransform("✏️ Modified code in: %s", id);
      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true }),
      };
    }

    return null;
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

    async transform(code, id, options) {
      logTransform("🔄 Transform: %s", id);

      if (this.environment.name !== "worker") {
        logTransform("⏭️ Skipping non-worker environment for: %s", id);
        return null;
      }

      // Check if this is a "use client" module
      let isClientModule = false;
      if (
        id.endsWith(".ts") ||
        id.endsWith(".js") ||
        id.endsWith(".tsx") ||
        id.endsWith(".jsx") ||
        id.endsWith(".mjs")
      ) {
        const firstLine = code.split("\n", 1)[0]?.trim();
        if (
          firstLine.startsWith("'use client'") ||
          firstLine.startsWith('"use client"')
        ) {
          logTransform("🎯 Found SSR entrypoint: %s", id);
          isClientModule = true;
        }
      }

      return processImports(this, code, id, isClientModule);
    },

    async load(id) {
      // Only handle prefixed IDs
      if (!id.startsWith(SSR_NAMESPACE)) {
        return null;
      }

      logLoad("📥 Loading virtualized module: %s", id);

      // Strip the prefix to get the real ID
      const realId = id.slice(SSR_NAMESPACE.length);
      logLoad("🔍 Real module ID: %s", realId);

      // Resolve the module
      const resolved = await this.resolve(realId);
      if (!resolved) {
        logError("❌ Failed to resolve real module: %s", realId);
        return null;
      }

      // Load the content
      let code = await fs.readFile(resolved.id, "utf-8");

      // Process the imports in this module as if it's a client module
      const result = await processImports(this, code, resolved.id, true);

      return result || { code };
    },
  };
}
