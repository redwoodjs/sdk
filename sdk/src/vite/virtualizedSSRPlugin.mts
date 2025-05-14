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
 * - Any module beginning with `"use client"` is treated as an SSR boundary.
 * - We configure optimizeDeps to include virtualized SSR modules, resolved
 *   using SSR export conditions and no "react-server" export condition
 * - When we encounter a "use client" module in transform:
 *   - For each import, we check if it's a dependency from our mapping
 *   - If it's a dependency, we prefix it with our virtual namespace
 *     (optimizeDeps will pick it up due to our configuration described above)
 *   - If not, we resolve it on-the-fly and prefix non-dep imports
 * - In load(), we intercept prefixed modules, strip the prefix, and then
 *   transform the code the same as we did for modules that made their way to
 *   transform()
 * - Basically: load() is used to process our virtualized modules, transform()
 *   is for the "use client" modules that we encounter, though we reuse the same
 *   logic for both
 *
 * This approach eliminates the need for tracking a custom module graph, making
 * the process more direct and following Vite's plugin lifecycle more naturally.
 */

import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";
import enhancedResolve from "enhanced-resolve";
import { init, parse } from "es-module-lexer";
import MagicString from "magic-string";
import debug from "debug";
import { glob } from "glob";
import { $ } from "../lib/$.mjs";

const SSR_NAMESPACE = "virtual:rwsdk:ssr:";
const log = debug("rwsdk:vite:virtualized-ssr");

const logInfo = log.extend("info");
const logError = log.extend("error");
const logResolve = log.extend("resolve");
const logTransform = log.extend("transform");
const logLoad = log.extend("load");
const logModuleIds = log.extend("module-ids");
const logScan = log.extend("scan");
const logWatch = log.extend("watch");

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
  let viteServer: any = null;

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

  /**
   * Resolves a bare import and adds it to our dependency mappings
   * @returns true if a new dependency was resolved and added
   */
  async function resolveBareImport(importPath: string): Promise<boolean> {
    // Skip if already in our mappings
    if (depPrefixMap.has(importPath)) {
      return false;
    }

    logResolve("🔍 Resolving bare import: %s", importPath);

    try {
      const resolved = ssrResolver(projectRootDir, importPath);

      if (!resolved) {
        logResolve("⚠️ Could not resolve: %s", importPath);
        return false;
      }

      // Create virtual ID and add to mappings
      const virtualId = SSR_NAMESPACE + importPath;
      virtualSsrDeps.set(virtualId, resolved);

      // Add to prefix map for rewriting imports
      depPrefixMap.set(importPath, virtualId);

      logResolve("✅ Resolved %s -> %s", importPath, resolved);
      return true;
    } catch (err) {
      logError("❌ Failed to resolve %s: %O", importPath, err);
      return false;
    }
  }

  /**
   * Updates Vite config with new dependencies and triggers optimization
   */
  function updateAndOptimize(): void {
    if (!viteServer) {
      logInfo("⚠️ Vite server not available, skipping optimization");
      return;
    }

    logInfo("🔄 Updating Vite config with dependencies");

    // Update optimizeDeps and alias
    updateViteConfig();

    // Trigger re-optimization
    viteServer.optimizeDeps();
    logInfo("✅ Triggered dependencies re-optimization");
  }

  /**
   * Process a collection of bare imports, resolving and adding them to mappings
   * @returns true if any new dependencies were added
   */
  async function processBareImports(
    imports: Set<string> | string[],
  ): Promise<boolean> {
    let newDepsFound = false;

    for (const importPath of imports) {
      const resolved = await resolveBareImport(importPath);
      if (resolved) {
        newDepsFound = true;
      }
    }

    return newDepsFound;
  }

  /**
   * Extracts bare imports from a file using es-module-lexer
   */
  async function extractBareImports(filePath: string): Promise<Set<string>> {
    const imports = new Set<string>();

    try {
      // Read the file content
      const content = await fs.readFile(filePath, "utf-8");

      // Initialize es-module-lexer (if not already initialized)
      await init;

      // Parse imports from the file
      const [moduleImports] = parse(content);

      // Process each import
      for (const imp of moduleImports) {
        const importPath = content.slice(imp.s, imp.e);

        // Skip relative/absolute imports, only process bare imports
        if (
          importPath.startsWith(".") ||
          importPath.startsWith("/") ||
          importPath.startsWith("virtual:")
        ) {
          continue;
        }

        imports.add(importPath);
      }
    } catch (err) {
      logError("❌ Failed to extract imports from %s: %O", filePath, err);
    }

    return imports;
  }

  /**
   * Scans source files using ast-grep to find bare imports
   */
  async function scanWithAstGrep(srcDir: string): Promise<Set<string>> {
    const imports = new Set<string>();

    // Try multiple patterns to cover different import styles
    const patterns = [
      "import { $$ } from '$importPath'", // named imports
      "import $name from '$importPath'", // default import
      "import * as $name from '$importPath'", // namespace import
      "import '$importPath'", // side-effect import
      "export * from '$importPath'", // re-export all
      "export { $$ } from '$importPath'", // named re-exports
    ];

    for (const pattern of patterns) {
      try {
        logScan("🔍 Running ast-grep with pattern: %s", pattern);

        const result =
          await $`npx ast-grep run -p "${pattern}" --json=compact --lang=tsx ${srcDir}`.catch(
            (err: Error) => {
              logError(
                "❌ Error running ast-grep with pattern %s: %O",
                pattern,
                err,
              );
              return { stdout: "[]" };
            },
          );

        const matches = JSON.parse(result.stdout || "[]");
        logScan(
          "📊 Found %d potential matches with pattern: %s",
          matches.length,
          pattern,
        );

        // Extract bare imports from the matches
        for (const match of matches) {
          if (!match.capture || !match.capture.importPath) continue;

          const importPath = match.capture.importPath;

          // Skip relative/absolute imports, only process bare imports
          if (importPath.startsWith('"') || importPath.startsWith("'")) {
            // Remove quotes from the import path
            const cleanImportPath = importPath.slice(1, -1);

            if (
              cleanImportPath.startsWith(".") ||
              cleanImportPath.startsWith("/") ||
              cleanImportPath.startsWith("virtual:")
            ) {
              continue;
            }

            imports.add(cleanImportPath);
          }
        }
      } catch (err) {
        logError(
          "❌ Error processing ast-grep results for pattern %s: %O",
          pattern,
          err,
        );
      }
    }

    return imports;
  }

  /**
   * Fallback method to scan files using es-module-lexer
   */
  async function scanWithEsModuleLexer(srcDir: string): Promise<Set<string>> {
    const imports = new Set<string>();

    // Get all JS/TS files in src directory
    const files = await glob("**/*.{js,jsx,ts,tsx,mjs,mts}", {
      cwd: srcDir,
      absolute: true,
    });

    logScan("📊 Found %d files to scan with es-module-lexer", files.length);

    // Initialize es-module-lexer
    await init;

    // Process all files to extract bare imports
    for (const file of files) {
      const fileImports = await extractBareImports(file);
      for (const importPath of fileImports) {
        imports.add(importPath);
      }
    }

    return imports;
  }

  async function resolvePackageDeps(): Promise<Map<string, string>> {
    logResolve("🔍 Scanning src directory for bare imports");
    const mappings = new Map<string, string>();

    try {
      const srcDir = path.join(projectRootDir, "src");
      logScan("📂 Scanning directory: %s", srcDir);

      // Try using ast-grep for scanning (it's best for finding all import patterns)
      try {
        logScan("✅ Using npx ast-grep for import scanning");
        const bareImports = await scanWithAstGrep(srcDir);
        logScan(
          "📊 Found %d unique bare imports with ast-grep",
          bareImports.size,
        );

        // Process and resolve all the bare imports
        await processBareImports(bareImports);
      } catch (astGrepError) {
        // If ast-grep fails, fall back to es-module-lexer
        logError(
          "❌ ast-grep failed, falling back to es-module-lexer: %O",
          astGrepError,
        );
        const bareImports = await scanWithEsModuleLexer(srcDir);
        logScan(
          "📊 Found %d unique bare imports with es-module-lexer",
          bareImports.size,
        );

        // Process and resolve all the bare imports
        await processBareImports(bareImports);
      }

      // Copy dependencies to the return mapping
      for (const [vId, real] of virtualSsrDeps.entries()) {
        mappings.set(vId, real);
      }
    } catch (err) {
      logError("❌ Error scanning src directory: %O", err);
    }

    logResolve("📊 Found %d dependencies during scan", mappings.size);
    return mappings;
  }

  async function processNewFile(filePath: string): Promise<void> {
    logWatch("🔄 Processing file change: %s", filePath);

    try {
      // Extract bare imports from the changed file
      const bareImports = await extractBareImports(filePath);

      if (bareImports.size === 0) {
        logWatch("⏭️ No bare imports found in changed file");
        return;
      }

      logWatch("📊 Found %d bare imports in changed file", bareImports.size);

      // Process the imports and check if any new ones were added
      const newDepsFound = await processBareImports(bareImports);

      // If new dependencies were found, update Vite config
      if (newDepsFound && viteServer) {
        logWatch("🔄 New dependencies found, updating configuration");
        updateAndOptimize();
      }
    } catch (err) {
      logError("❌ Failed to process file change %s: %O", filePath, err);
    }
  }

  function updateViteConfig(): void {
    if (!viteServer || !viteServer.config) {
      logError("⚠️ Cannot update Vite config, server not available");
      return;
    }

    const config = viteServer.config;

    // Update resolve.alias
    config.resolve ??= {};
    config.resolve.alias ??= [];

    if (!Array.isArray(config.resolve.alias)) {
      const aliasObj = config.resolve.alias;
      config.resolve.alias = Object.entries(aliasObj).map(
        ([find, replacement]) => ({ find, replacement }),
      );
    }

    // Clear existing aliases for our namespace
    config.resolve.alias = config.resolve.alias.filter(
      (alias: any) =>
        typeof alias.find !== "object" ||
        !String(alias.find).includes(SSR_NAMESPACE),
    );

    // Add all current virtual SSR deps as aliases
    for (const [vId, realPath] of virtualSsrDeps) {
      config.resolve.alias.push({
        find: new RegExp(`^${vId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
        replacement: realPath,
      });
    }

    // Update optimizeDeps
    config.optimizeDeps ??= {};
    config.optimizeDeps.include ??= [];

    // Add all our virtual deps to optimizeDeps.include
    for (const vId of virtualSsrDeps.keys()) {
      if (!config.optimizeDeps.include.includes(vId)) {
        config.optimizeDeps.include.push(vId);
      }
    }

    logInfo(
      "✅ Updated Vite config with %d SSR virtual aliases",
      virtualSsrDeps.size,
    );
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

      try {
        // First check if it's in our known deps mapping
        const prefix = depPrefixMap.get(raw);

        if (prefix) {
          logTransform(
            "🔄 Found mapped dependency import: %s → %s",
            raw,
            prefix,
          );
          ms.overwrite(i.s, i.e, prefix);
          modified = true;
        } else if (
          !raw.startsWith(".") &&
          !raw.startsWith("/") &&
          !raw.startsWith("virtual:")
        ) {
          // This is a bare import not in our mapping, try to resolve it on-the-fly
          logTransform(
            "🔍 Attempting to resolve unmapped bare import: %s",
            raw,
          );

          try {
            const resolved = ssrResolver(projectRootDir, raw);

            if (resolved) {
              // Create virtual ID and add to mappings
              const virtualId = SSR_NAMESPACE + raw;
              virtualSsrDeps.set(virtualId, resolved);

              // Add to prefix map for rewriting imports
              depPrefixMap.set(raw, virtualId);

              // Update Vite config if we have a server
              if (viteServer) {
                updateViteConfig();
                // Trigger optimization in development mode
                viteServer.optimizeDeps();
              }

              logTransform("✅ Resolved on-the-fly: %s → %s", raw, virtualId);
              ms.overwrite(i.s, i.e, virtualId);
              modified = true;
            }
          } catch (err) {
            logError("❌ Failed to resolve bare import %s: %O", raw, err);
          }
        } else {
          // For relative/absolute imports
          const resolved = await context.resolve(raw, id);

          if (resolved && !isDep(resolved.id)) {
            const moduleId = getVirtualModuleId(resolved.id);
            const virtualId = SSR_NAMESPACE + moduleId;

            logTransform(
              "🔁 Rewriting relative/absolute import: %s → %s",
              raw,
              virtualId,
            );
            ms.overwrite(i.s, i.e, virtualId);
            modified = true;
          } else {
            logTransform(
              "⏭️ Skipping import: %s (resolved to %s)",
              raw,
              resolved?.id || "unresolved",
            );
          }
        }
      } catch (err) {
        logError("❌ Error processing import %s: %O", raw, err);
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

    configureServer(server) {
      viteServer = server;

      // Set up watcher for src directory
      const srcDir = path.join(projectRootDir, "src");
      logWatch("👀 Setting up file watcher for: %s", srcDir);

      // Watch for file changes in src directory
      server.watcher.on("add", (path: string) => {
        if (
          path.startsWith(srcDir) &&
          /\.(js|jsx|ts|tsx|mjs|mts)$/.test(path)
        ) {
          processNewFile(path);
        }
      });

      server.watcher.on("change", (path: string) => {
        if (
          path.startsWith(srcDir) &&
          /\.(js|jsx|ts|tsx|mjs|mts)$/.test(path)
        ) {
          processNewFile(path);
        }
      });
    },

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

      // Scan src directory for imports
      const depsMap = await resolvePackageDeps();

      // Add all found deps to virtualSsrDeps
      for (const [vId, real] of depsMap.entries()) {
        virtualSsrDeps.set(vId, real);
      }

      // Add all aliases to config
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

      // Check if this is in our known dependencies
      if (virtualSsrDeps.has(id)) {
        const resolvedPath = virtualSsrDeps.get(id)!;
        logLoad("✅ Using known mapping: %s → %s", id, resolvedPath);
        try {
          const code = await fs.readFile(resolvedPath, "utf-8");
          logLoad(
            "📄 Loaded %d bytes of content from resolved path",
            code.length,
          );

          // Process the imports in this module
          logLoad("🔄 Processing imports in resolved module");
          const result = await processImports(this, code, resolvedPath, true);

          return result || { code };
        } catch (err) {
          logError("❌ Failed to read file at %s: %O", resolvedPath, err);
          return null;
        }
      }

      // Not in our mappings, try to resolve through Vite
      logLoad("🔍 Resolving through Vite: %s", moduleId);
      const resolved = await this.resolve(moduleId);
      if (!resolved) {
        logError("❌ Failed to resolve module: %s", moduleId);
        return null;
      }

      logLoad("✅ Resolved through Vite to: %s", resolved.id);
      try {
        // Load the content
        const code = await fs.readFile(resolved.id, "utf-8");
        logLoad("📄 Loaded %d bytes of content", code.length);

        // Process the imports in this module
        logLoad("🔄 Processing imports in resolved module");
        const result = await processImports(this, code, resolved.id, true);

        return result || { code };
      } catch (err) {
        logError("❌ Failed to read file at %s: %O", resolved.id, err);
        return null;
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

        // If it's not in our known mappings but is a bare import, try to resolve it
        if (!moduleId.startsWith("/") && !moduleId.includes(":")) {
          try {
            const resolved = ssrResolver(projectRootDir, moduleId);
            if (resolved) {
              // Add to our mappings for future use
              virtualSsrDeps.set(source, resolved);
              logResolve(
                "✅ Resolved unmapped virtual module on-the-fly: %s → %s",
                source,
                resolved,
              );
              return resolved;
            }
          } catch (err) {
            logError("❌ Failed to resolve %s on-the-fly: %O", moduleId, err);
          }
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
