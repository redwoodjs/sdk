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

const SSR_NAMESPACE = "virtual:rwsdk:ssr/";

const log = debug("rwsdk:vite:virtualized-ssr");

const ssrGraph = new Set<string>();
const virtualSsrDeps = new Map<string, string>();

const ssrResolver = enhancedResolve.create.sync({
  conditionNames: ["edge", "default"],
});

export function virtualizedSSRPlugin({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin {
  log("Initializing with projectRootDir: %s", projectRootDir);

  return {
    name: "rwsdk:virtualized-ssr",

    async transform(code, id) {
      if (this.environment.name !== "worker") return;

      if (!id.match(/\.(tsx?|jsx?|mjs|mts|cjs)$/)) return;

      const firstLine = code.split("\n", 1)[0]?.trim();
      if (firstLine === '"use client"' || firstLine === "'use client'") {
        ssrGraph.add(id);
        log("Discovered SSR entrypoint via 'use client': %s", id);
      }

      return null;
    },

    resolveId(source, importer) {
      if (this.environment.name !== "worker" || !importer) return;

      const isBare = !source.startsWith(".") && !source.startsWith("/");

      if (importer.startsWith(SSR_NAMESPACE) && isBare) {
        const resolved = ssrResolver(projectRootDir, source);
        if (!resolved) return;

        const virtualId = SSR_NAMESPACE + source;
        virtualSsrDeps.set(virtualId, resolved);
        return virtualId;
      }

      if (ssrGraph.has(importer)) {
        const resolved = ssrResolver(path.dirname(importer), source);
        if (!resolved) return;

        const virtualResolved = SSR_NAMESPACE + resolved;
        ssrGraph.add(resolved);
        return virtualResolved;
      }

      return null;
    },

    async configEnvironment(env, config) {
      if (env !== "worker") return;

      log("Setting up aliases for worker environment");

      config.resolve ??= {};
      (config.resolve as any).alias ??= [];

      if (!Array.isArray((config.resolve as any).alias)) {
        const existingAlias = (config.resolve as any).alias;
        (config.resolve as any).alias = Object.entries(existingAlias).map(
          ([find, replacement]) => ({ find, replacement }),
        );
      }

      const pkgJsonPath = path.join(projectRootDir, "package.json");
      let dependencies: string[] = [];

      try {
        const pkgRaw = await fs.readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(pkgRaw);
        dependencies = Object.keys(pkg.dependencies ?? {});
      } catch (err) {
        log("Failed to read package.json from %s", pkgJsonPath);
        return;
      }

      for (const dep of dependencies) {
        try {
          const resolved = ssrResolver(projectRootDir, dep);
          const virtualId = SSR_NAMESPACE + dep;
          virtualSsrDeps.set(virtualId, resolved);
        } catch {
          log("Could not resolve %s using SSR resolver", dep);
        }
      }

      for (const [virtualId, resolvedPath] of virtualSsrDeps.entries()) {
        (config.resolve as any).alias.push({
          find: virtualId,
          replacement: resolvedPath,
        });
      }

      config.optimizeDeps ??= {};
      config.optimizeDeps.include ??= [];
      config.optimizeDeps.include.push(...virtualSsrDeps.keys());

      log("Registered %d SSR aliases", virtualSsrDeps.size);
    },
  };
}
