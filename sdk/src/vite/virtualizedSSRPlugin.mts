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
const logVirtualIds = log.extend("virtual-ids");
const logModuleIds = log.extend("module-ids");

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
  logInfo(
    "📂 Plugin will handle client/server module resolution in a single Vite worker environment",
  );

  const virtualSsrDeps = new Map<string, string>();
  const depPrefixMap = new Map<string, string>();
  const moduleIdMap = new Map<string, string>();

  // Generate a stable virtual module ID without exposing file system paths
  function getVirtualModuleId(fullPath: string): string {
    // Check if we already have a virtual ID for this path
    if (moduleIdMap.has(fullPath)) {
      const cachedId = moduleIdMap.get(fullPath)!;
      logModuleIds("📋 Using cached module ID for %s: %s", fullPath, cachedId);
      return cachedId;
    }

    logModuleIds("✅ Generated module ID: %s", fullPath);

    // Store the mapping for future lookups
    moduleIdMap.set(fullPath, fullPath);

    return fullPath;
  }

  async function resolvePackageDeps(dep: string): Promise<Map<string, string>> {
    logResolve("🔍 Resolving package dependencies for: %s", dep);
    logResolve(
      "   Using resolver with conditions: workerd, edge, import, default",
    );

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
      logResolve("📂 Starting package.json search from: %s", dir);

      while (dir !== projectRootDir) {
        const pkgJsonPath = path.join(dir, "package.json");
        logResolve("📦 Looking for package.json at: %s", pkgJsonPath);

        try {
          await fs.access(pkgJsonPath);
          const raw = await fs.readFile(pkgJsonPath, "utf-8");
          const pkg = JSON.parse(raw);
          logResolve("📦 Found package.json for %s", dep);
          logResolve(
            "   Name: %s, Version: %s",
            pkg.name || "unknown",
            pkg.version || "unknown",
          );

          // Resolve root entry
          const virtualId = SSR_NAMESPACE + dep;
          mappings.set(virtualId, entry);
          logResolve("➕ Mapping %s -> %s", virtualId, entry);

          // Track rewrite mapping
          depPrefixMap.set(dep, virtualId);
          logResolve("📝 Added rewrite mapping %s -> %s", dep, virtualId);

          // Resolve exports subpaths
          if (typeof pkg.exports === "object" && pkg.exports !== null) {
            const exportKeys = Object.keys(pkg.exports);
            logResolve(
              "📦 Processing exports for %s: Found %d export paths",
              dep,
              exportKeys.length,
            );

            for (const key of exportKeys) {
              if (!key.startsWith("./") || key === "./package.json") {
                logResolve("⏭️ Skipping export path: %s", key);
                continue;
              }

              const sub = key.slice(2); // './infinite' -> 'infinite'
              const full = `${dep}/${sub}`;
              logResolve("🔍 Processing export subpath: %s → %s", key, full);

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
    if (mappings.size > 0) {
      logResolve("📋 Summary of mappings for %s:", dep);
      for (const [vId, real] of mappings.entries()) {
        logResolve("   %s → %s", vId, real);
      }
    }

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
      logTransform("⏭️ Skipping non-client module: %s", id);
      return null;
    }

    logTransform(
      "🔎 Processing imports in client module or module imported by one: %s",
      id,
    );
    await init;
    const [imports] = parse(code);
    logTransform("📊 Found %d imports to process", imports.length);

    const ms = new MagicString(code);
    let modified = false;

    for (const i of imports) {
      const raw = code.slice(i.s, i.e);
      // Check if it's in our known deps mapping
      const prefix = depPrefixMap.get(raw);

      if (prefix) {
        logTransform("🔄 Found dependency import: %s → %s", raw, prefix);
        ms.overwrite(i.s, i.e, prefix);
        modified = true;
      } else {
        // Not in our mapping, use context.resolve() to check if it's a non-node_modules import
        try {
          logTransform("🔍 Resolving import: %s from %s", raw, id);
          const resolved = await context.resolve(raw, id);

          if (!resolved) {
            logTransform("⚠️ Failed to resolve import: %s", raw);
            continue;
          }

          logTransform("📍 Resolved to: %s", resolved.id);

          if (!isDep(resolved.id)) {
            // For imports that start with '.', we need to handle the resolution carefully
            const moduleId = getVirtualModuleId(resolved.id);
            // Add the prefix to create the final virtual ID
            const virtualId = SSR_NAMESPACE + moduleId;

            logTransform(
              "🔁 Rewriting import: %s → %s (resolved: %s → module ID: %s)",
              raw,
              virtualId,
              resolved.id,
              moduleId,
            );
            ms.overwrite(i.s, i.e, virtualId);
            modified = true;
          } else {
            logTransform(
              "⏭️ Skipping dependency import: %s (resolved to %s)",
              raw,
              resolved.id,
            );
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

    logTransform("⏭️ No modifications needed for: %s", id);
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

      const pkgPath = path.join(projectRootDir, "package.json");
      logInfo("📦 Reading package.json from: %s", pkgPath);

      const pkgRaw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgRaw);
      const deps = Object.keys(pkg.dependencies ?? {});
      logInfo("📦 Found %d dependencies to process", deps.length);

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
      if (this.environment.name !== "worker") {
        return null;
      }

      logTransform("🔄 Transform: %s", id);

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

      // Strip the prefix to get the module ID
      const moduleId = id.slice(SSR_NAMESPACE.length);
      logLoad("🔍 Module ID: %s", moduleId);

      logLoad("📂 Checking for file: %s", moduleId);

      // Check if this is a file that exists
      try {
        await fs.access(moduleId);
        logLoad("✅ File exists, loading content directly");
        // Load the content directly
        const code = await fs.readFile(moduleId, "utf-8");
        logLoad("📄 Loaded %d bytes of content", code.length);

        // Process the imports in this module
        logLoad("🔄 Processing imports in loaded module");
        const result = await processImports(this, code, moduleId, true);

        return result || { code };
      } catch (err) {
        // If not found as a direct file, try to resolve through Vite
        logLoad("⚠️ File not found directly, falling back to Vite resolution");
        const resolved = await this.resolve(moduleId);
        if (!resolved) {
          logError("❌ Failed to resolve module: %s", moduleId);
          return null;
        }

        logLoad("✅ Resolved through Vite to: %s", resolved.id);
        // Load the content
        const code = await fs.readFile(resolved.id, "utf-8");
        logLoad("📄 Loaded %d bytes of content", code.length);

        // Process the imports in this module
        logLoad("🔄 Processing imports in resolved module");
        const result = await processImports(this, code, resolved.id, true);

        return result || { code };
      }
    },

    resolveId(source, importer, options) {
      if (source.startsWith(SSR_NAMESPACE)) {
        // Get the module ID from the virtual ID
        const moduleId = source.slice(SSR_NAMESPACE.length);

        logResolve(
          "🔍 Resolving virtual module: %s from %s",
          moduleId,
          importer || "unknown",
        );

        // Check if this is one of our known dependencies
        if (virtualSsrDeps.has(source)) {
          const resolvedPath = virtualSsrDeps.get(source)!;
          logResolve(
            "✨ Using predefined alias for dependency: %s → %s",
            source,
            resolvedPath,
          );
          return resolvedPath;
        }

        logResolve(
          "🔍 Keeping original ID as resolveId() result so we transform its imports: %s",
          source,
        );
        return source;
      }

      return null;
    },
  };
}
