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
 * We remain in a single Vite environment (`worker`), and simulate distinct graphs
 * by using virtual module IDs:
 *
 * - The RSC graph is canonical — modules resolve as-is using "react-server"
 * - The SSR graph is virtualised — import paths are rewritten to `virtual:rwsdk:ssr/...`
 *   to break Vite's resolution cache and apply different conditions
 *
 * A module whose contents begin with "use client" acts as the entry point
 * into this virtualised SSR graph. All of its imports — and their transitive imports —
 * are rewritten through `resolveId()` to use SSR-specific resolution rules.
 *
 * Bare imports like `react` become `virtual:rwsdk:ssr/react`, and normal relative
 * imports like `./foo.ts` become `virtual:rwsdk:ssr/abs/path/to/foo.ts`.
 *
 * To support optimizeDeps and alias resolution, we eagerly resolve all declared
 * `dependencies` from the user's `package.json` using SSR conditions and map them
 * to virtual IDs during the `configEnvironment()` hook.
 */

import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";
import enhancedResolve from "enhanced-resolve";
import debug from "debug";

const SSR_NAMESPACE = "virtual:rwsdk:ssr:";

const log = debug("rwsdk:vite:virtualized-ssr");

const ssrGraph = new Set<string>();
const virtualSsrDeps = new Map<string, string>();

const ssrResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

/**
 * Resolves a package and its export paths
 */
async function resolvePackageDeps(
  dep: string,
  projectRootDir: string,
  resolver: typeof ssrResolver,
): Promise<Map<string, string>> {
  const depMappings = new Map<string, string>();

  log("📦 Starting resolution for dependency: %s", dep);

  try {
    log("🔍 Resolving package entry point for: %s", dep);
    const entryPoint = resolver(projectRootDir, dep);
    if (!entryPoint) {
      log("❌ Failed to resolve entry point for %s", dep);
      return depMappings;
    }
    log("✅ Found entry point: %s", entryPoint);

    // Find package root by looking for nearest package.json
    let pkgRoot = path.dirname(entryPoint);
    let pkgJsonPath = "";

    log("🔍 Looking for package.json from entry point: %s", entryPoint);
    // Navigate up directories until we find package.json
    while (pkgRoot && pkgRoot !== projectRootDir) {
      const candidatePath = path.join(pkgRoot, "package.json");
      try {
        await fs.access(candidatePath);
        pkgJsonPath = candidatePath;
        log("✅ Found package.json at: %s", pkgJsonPath);
        break;
      } catch {
        // Move up one directory
        const prevRoot = pkgRoot;
        pkgRoot = path.dirname(pkgRoot);
        log("⬆️ Moving up from %s to %s", prevRoot, pkgRoot);
      }
    }

    if (!pkgJsonPath) {
      log(
        "❌ Could not find package.json for %s after traversing directories",
        dep,
      );
      return depMappings;
    }

    log("📄 Found package.json at %s", pkgJsonPath);
    log("📁 Package root directory: %s", pkgRoot);

    const pkgRaw = await fs.readFile(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(pkgRaw);
    log(
      "📦 Package %s details: main=%s, exports=%d entries",
      dep,
      pkg.main || "(none)",
      pkg.exports ? Object.keys(pkg.exports).length : 0,
    );

    // Always include the root entry
    log("🔍 Resolving root entry for %s", dep);
    const rootResolved = resolver(pkgRoot, ".");
    log("🔄 Root resolved: %s -> %s", dep, rootResolved || "(failed)");

    if (rootResolved) {
      const virtualId = SSR_NAMESPACE + dep;
      depMappings.set(virtualId, rootResolved);
      log("✅ Added root mapping %s -> %s", virtualId, rootResolved);
    } else {
      log("❌ Failed to resolve root entry for %s", dep);
    }

    // Handle subpaths declared in `exports`
    if (typeof pkg.exports === "object" && pkg.exports !== null) {
      const exportKeys = Object.keys(pkg.exports);
      log(
        "🔄 Processing exports from %s - found %d export paths",
        dep,
        exportKeys.length,
      );
      const keys = exportKeys.filter(
        (k) => k.startsWith("./") && k !== "./package.json",
      );
      log("🔍 Filtered %d relevant export paths for %s", keys.length, dep);

      for (const key of keys) {
        const subpath = key.slice(2); // "./infinite" -> "infinite"
        const virtualId = SSR_NAMESPACE + dep + "/" + subpath;
        log(
          "🔄 Processing export path %s -> creating virtual ID %s",
          key,
          virtualId,
        );

        const resolved = resolver(pkgRoot, "./" + subpath);
        log("🔍 Resolved %s/%s -> %s", dep, subpath, resolved || "(failed)");

        if (resolved) {
          depMappings.set(virtualId, resolved);
          log("✅ Added subpath mapping %s -> %s", virtualId, resolved);
        } else {
          log("❌ Failed to resolve %s/%s", dep, subpath);
        }
      }
    } else {
      log("ℹ️ Package %s has no exports object or it's empty", dep);
    }

    log(
      "📊 Finished processing %s - created %d mappings",
      dep,
      depMappings.size,
    );
  } catch (err) {
    log("❌ Error resolving %s or its exports: %O", dep, err);
  }

  return depMappings;
}

export function virtualizedSSRPlugin({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin {
  log(
    "🚀 Initializing virtualizedSSRPlugin with projectRootDir: %s",
    projectRootDir,
  );

  return {
    name: "rwsdk:virtualized-ssr",

    async configEnvironment(env, config) {
      if (env !== "worker") {
        log(
          "⏭️ Skipping configEnvironment for non-worker environment: %s",
          env,
        );
        return;
      }

      log("🔧 Setting up aliases for worker environment");

      config.resolve ??= {};
      (config.resolve as any).alias ??= [];

      if (!Array.isArray((config.resolve as any).alias)) {
        const existingAlias = (config.resolve as any).alias;
        log(
          "🔄 Converting object alias to array format, found %d existing aliases",
          Object.keys(existingAlias).length,
        );
        (config.resolve as any).alias = Object.entries(existingAlias).map(
          ([find, replacement]) => ({ find, replacement }),
        );
      }

      const pkgJsonPath = path.join(projectRootDir, "package.json");
      let dependencies: string[] = [];

      try {
        log("📄 Reading project package.json from %s", pkgJsonPath);
        const pkgRaw = await fs.readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(pkgRaw);
        dependencies = Object.keys(pkg.dependencies ?? {});
        log("📦 Found %d dependencies to process", dependencies.length);
      } catch (err) {
        log("❌ Failed to read package.json from %s: %O", pkgJsonPath, err);
        return;
      }

      log("🔄 Starting dependency resolution process");
      for (const dep of dependencies) {
        if (dep === "rwsdk") {
          log("⏭️ Skipping rwsdk dependency");
          continue;
        }

        log("📦 Processing dependency: %s", dep);
        const depMappings = await resolvePackageDeps(
          dep,
          projectRootDir,
          ssrResolver,
        );
        log("📊 Resolved %d mappings for %s", depMappings.size, dep);

        // Add all resolved mappings to our virtualSsrDeps map
        for (const [virtualId, resolvedPath] of depMappings) {
          virtualSsrDeps.set(virtualId, resolvedPath);
          log("🔄 Added to global mappings: %s -> %s", virtualId, resolvedPath);
        }
      }

      log(
        "🔧 Adding %d virtual SSR aliases to Vite config: %O",
        virtualSsrDeps.size,
        virtualSsrDeps,
      );
      for (const [virtualId, resolvedPath] of virtualSsrDeps.entries()) {
        const exactMatchRegex = new RegExp(
          `^${virtualId.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
        );

        (config.resolve as any).alias.push({
          find: exactMatchRegex,
          replacement: resolvedPath,
        });
      }

      config.optimizeDeps ??= {};
      config.optimizeDeps.include ??= [];
      log(
        "🔧 Adding %d virtual IDs to optimizeDeps.include",
        virtualSsrDeps.size,
      );
      config.optimizeDeps.include.push(...virtualSsrDeps.keys());

      log(
        "✅ Registered %d SSR aliases for virtual import resolution",
        virtualSsrDeps.size,
      );
    },

    async transform(code, id) {
      if (this.environment.name !== "worker") {
        return;
      }

      if (!id.match(/\.(tsx?|jsx?|mjs|mts|cjs)$/)) {
        return;
      }

      const firstLine = code.split("\n", 1)[0]?.trim();
      if (firstLine === '"use client"' || firstLine === "'use client'") {
        ssrGraph.add(id);
        log("🔎 Discovered SSR entrypoint via 'use client': %s", id);
      }

      return null;
    },

    resolveId(source, importer) {
      if (this.environment.name !== "worker" || !importer) {
        log(
          "⏭️ Skipping resolveId for %s from %s (not in worker or no importer)",
          source,
          importer,
        );
        return;
      }

      log(
        "🔍 resolveId called for source=%s from importer=%s",
        source,
        importer,
      );

      const isBare = !source.startsWith(".") && !source.startsWith("/");

      // Case 1: Already in SSR graph via a virtualized importer
      if (importer.startsWith(SSR_NAMESPACE) && isBare) {
        log(
          "📦 Import from virtualized module: %s imports %s",
          importer,
          source,
        );

        const resolved = ssrResolver(projectRootDir, source);
        if (!resolved) {
          log(
            "❌ Failed to resolve %s from virtual module %s",
            source,
            importer,
          );
          return;
        }

        const virtualId = SSR_NAMESPACE + source;
        log(
          "✅ Resolved bare import in SSR context: %s -> %s (virtual: %s)",
          source,
          resolved,
          virtualId,
        );

        virtualSsrDeps.set(virtualId, resolved);
        return virtualId;
      }

      // Case 2: Module is in the SSR graph via 'use client'
      if (ssrGraph.has(importer)) {
        log(
          "📦 Import from 'use client' module: %s imports %s",
          importer,
          source,
        );

        const resolved = ssrResolver(path.dirname(importer), source);
        if (!resolved) {
          log(
            "❌ Failed to resolve %s from 'use client' module %s",
            source,
            importer,
          );
          return;
        }

        const virtualResolved = SSR_NAMESPACE + resolved;
        log(
          "✅ Resolved import in 'use client' context: %s -> %s (virtual: %s)",
          source,
          resolved,
          virtualResolved,
        );

        ssrGraph.add(resolved);
        return virtualResolved;
      }

      // Not part of SSR graph, let Vite handle it normally
      log("⏭️ Import not in SSR context: %s from %s", source, importer);
      return null;
    },
  };
}
