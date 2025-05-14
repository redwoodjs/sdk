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
 * We remain in a single Vite environment (`worker`) and simulate distinct resolution graphs.
 *
 * - We scan all modules and detect those starting with `"use client"` as entrypoints into
 *   the SSR graph. From there, we track their transitive imports.
 *
 * - During `configEnvironment`, we read the user's `package.json` and resolve each declared
 *   dependency — including its `exports` subpaths — using SSR conditions. Each is assigned
 *   a corresponding `virtual:rwsdk:ssr/...` ID and added to the alias map and optimizeDeps.
 *
 * - In the `transform` hook, we rewrite import specifiers to their virtual equivalents
 *   if the module is part of the SSR graph and the import matches a resolved dependency.
 *
 * - Only bare imports (`react`, `swr/infinite`, etc.) are virtualised; relative imports are left as-is.
 *
 * This gives us two overlapping graphs — canonical RSC and virtualised SSR — within a single
 * runtime, with accurate export conditions and no bundle duplication.
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

const ssrResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

export function virtualizedSSRPlugin({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin {
  const ssrGraph = new Set<string>();
  const virtualSsrDeps = new Map<string, string>();
  const depPrefixMap = new Map<string, string>();

  async function resolvePackageDeps(dep: string): Promise<Map<string, string>> {
    const mappings = new Map<string, string>();
    try {
      const entry = ssrResolver(projectRootDir, dep);
      if (!entry) return mappings;

      // Find the root package.json
      let dir = path.dirname(entry);
      while (dir !== projectRootDir) {
        const pkgJsonPath = path.join(dir, "package.json");
        try {
          await fs.access(pkgJsonPath);
          const raw = await fs.readFile(pkgJsonPath, "utf-8");
          const pkg = JSON.parse(raw);

          // Resolve root entry
          const virtualId = SSR_NAMESPACE + dep;
          mappings.set(virtualId, entry);

          // Track rewrite mapping
          depPrefixMap.set(dep, virtualId);

          // Resolve exports subpaths
          if (typeof pkg.exports === "object" && pkg.exports !== null) {
            for (const key of Object.keys(pkg.exports)) {
              if (!key.startsWith("./") || key === "./package.json") continue;

              const sub = key.slice(2); // './infinite' -> 'infinite'
              const full = `${dep}/${sub}`;
              const resolved = ssrResolver(dir, "./" + sub);
              const vId = SSR_NAMESPACE + full;
              if (resolved) {
                mappings.set(vId, resolved);
                depPrefixMap.set(full, vId);
              }
            }
          }

          break;
        } catch {
          dir = path.dirname(dir);
        }
      }
    } catch (err) {
      log("❌ Failed to resolve %s: %O", dep, err);
    }
    return mappings;
  }

  return {
    name: "rwsdk:virtualized-ssr",
    enforce: "pre",

    async configEnvironment(env, config) {
      if (env !== "worker") return;

      config.resolve ??= {};
      (config.resolve as any).alias ??= [];

      if (!Array.isArray((config.resolve as any).alias)) {
        const aliasObj = (config.resolve as any).alias;
        (config.resolve as any).alias = Object.entries(aliasObj).map(
          ([find, replacement]) => ({ find, replacement }),
        );
      }

      const pkgPath = path.join(projectRootDir, "package.json");
      const pkgRaw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgRaw);
      const deps = Object.keys(pkg.dependencies ?? {});

      for (const dep of deps) {
        if (dep === "rwsdk") continue;
        const resolved = await resolvePackageDeps(dep);
        for (const [vId, real] of resolved.entries()) {
          virtualSsrDeps.set(vId, real);
        }
      }

      for (const [vId, realPath] of virtualSsrDeps) {
        (config.resolve as any).alias.push({
          find: new RegExp(`^${vId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
          replacement: realPath,
        });
      }

      config.optimizeDeps ??= {};
      config.optimizeDeps.include ??= [];
      config.optimizeDeps.include.push(...virtualSsrDeps.keys());

      log("✅ Registered %d SSR virtual aliases", virtualSsrDeps.size);
    },

    async transform(code, id, options) {
      if (this.environment.name !== "worker") return;

      if (
        id.endsWith(".ts") ||
        id.endsWith(".js") ||
        id.endsWith(".tsx") ||
        id.endsWith(".jsx") ||
        id.endsWith(".mjs")
      ) {
        const firstLine = code.split("\n", 1)[0]?.trim();
        if (firstLine === "'use client'" || firstLine === '"use client"') {
          log("🔎 Found SSR entrypoint: %s", id);
          ssrGraph.add(id);
        }
      }

      // Propagate SSR graph to all importers
      const moduleInfo = this.getModuleInfo?.(id);
      const shouldRewrite =
        ssrGraph.has(id) ||
        moduleInfo?.importers?.some((imp) => ssrGraph.has(imp));

      if (!shouldRewrite) return null;

      await init;
      const [imports] = parse(code);
      const ms = new MagicString(code);
      let modified = false;

      for (const i of imports) {
        const raw = code.slice(i.s, i.e);
        const prefix = depPrefixMap.get(raw);
        if (prefix) {
          log("🔁 Rewriting %s -> %s", raw, prefix);
          ms.overwrite(i.s, i.e, prefix);
          modified = true;
        }
      }

      if (modified) {
        return {
          code: ms.toString(),
          map: ms.generateMap({ hires: true }),
        };
      }

      return null;
    },
  };
}
