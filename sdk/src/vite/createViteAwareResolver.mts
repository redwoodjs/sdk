import resolve, { ResolveOptions } from "enhanced-resolve";
import { Alias, ResolvedConfig } from "vite";
import fs from "fs";
import path from "path";
import createDebug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { Environment } from "vite";
const debug = createDebug("rwsdk:vite:enhanced-resolve-plugin");

let resolveIdCounter = 0;

// Enhanced-resolve plugin that wraps Vite plugin resolution
class VitePluginResolverPlugin {
  private enhancedResolver: any;

  constructor(
    private environment: any,
    private source = "resolve",
    private target = "resolved",
  ) {
    // Create an enhanced-resolve instance for the plugin context
    const baseOptions = mapViteResolveToEnhancedResolveOptions(
      this.environment.config,
      this.environment.name,
    );
    this.enhancedResolver = resolve.create(baseOptions);
  }

  apply(resolver: any) {
    const target = resolver.ensureHook(this.target);
    resolver
      .getHook(this.source)
      .tapAsync(
        "VitePluginResolverPlugin",
        (request: any, resolveContext: any, callback: any) => {
          const resolveId = ++resolveIdCounter;
          debug(`[${resolveId}] VitePluginResolverPlugin`, {
            request: request.request,
            path: request.path,
          });

          const plugins = this.environment?.plugins;
          if (!plugins) {
            return callback();
          }

          // Create a plugin context with enhanced-resolve-based resolve method
          const pluginContext = {
            environment: this.environment,
            resolve: async (id: string, importer?: string) => {
              return new Promise<{ id: string } | null>((resolve) => {
                this.enhancedResolver(
                  {},
                  importer || this.environment.config.root,
                  id,
                  {},
                  (err: any, result: any) => {
                    if (!err && result) {
                      debug(
                        `[${resolveId}] Context resolve: %s -> %s`,
                        id,
                        result,
                      );
                      resolve({ id: result });
                    } else {
                      debug(
                        `[${resolveId}] Context resolve failed for %s: %s`,
                        id,
                        err?.message || "not found",
                      );
                      resolve(null);
                    }
                  },
                );
              });
            },
          };

          debug(
            `[${resolveId}] Trying to resolve %s from %s`,
            request.request,
            request.path,
          );

          // This function encapsulates the logic to process Vite plugins for a given request.
          const runPluginProcessing = async () => {
            let currentRequest = request;

            for (const p of plugins) {
              if (typeof p.resolveId !== "function") {
                continue;
              }

              const pluginName = p.name;
              debug(`[${resolveId}] Trying plugin:`, pluginName);

              try {
                const result = await p.resolveId.call(
                  pluginContext,
                  currentRequest.request,
                  currentRequest.path,
                  { scan: true },
                );

                if (result) {
                  debug(
                    `[${resolveId}] Plugin ${pluginName} resolved to:`,
                    result,
                  );
                  let resolvedId =
                    typeof result === "string" ? result : result.id;

                  if (resolvedId && resolvedId !== currentRequest.request) {
                    debug(
                      `[${resolveId}] Plugin ${pluginName} resolved ${currentRequest.request} -> ${resolvedId}`,
                      pluginName,
                    );
                    return callback(null, {
                      ...currentRequest,
                      path: resolvedId,
                    });
                  } else if (resolvedId === currentRequest.request) {
                    debug(
                      `[${resolveId}] Plugin ${pluginName} returned unchanged ID`,
                      pluginName,
                    );
                  }
                } else {
                  debug(`[${resolveId}] Plugin ${pluginName} did not resolve.`);
                }
              } catch (e: any) {
                debug(`[${resolveId}] Plugin ${pluginName} threw an error:`, e);
                return callback(e);
              }
            }
            debug(`[${resolveId}] No plugin resolved the path, falling back.`);

            // For absolute paths, check if the file exists
            if (path.isAbsolute(currentRequest.request)) {
              try {
                if (fs.existsSync(currentRequest.request)) {
                  debug(
                    `[${resolveId}] File exists, resolving to: %s`,
                    currentRequest.request,
                  );
                  const osifiedPath = normalizeModulePath(
                    currentRequest.request,
                    this.environment.config.root,
                    { absolute: true, osify: "fileUrl" },
                  );
                  debug(`[${resolveId}] Osified fallback path:`, osifiedPath);
                  return callback(null, {
                    ...currentRequest,
                    path: osifiedPath,
                  });
                }
              } catch (e) {
                debug(
                  `[${resolveId}] Error checking file existence for fallback:`,
                  e,
                );
              }
            }

            debug(`[${resolveId}] Fallback finished.`);
            return callback(null, currentRequest);
          };

          // For relative imports, normalize them to absolute paths first
          if (
            request.request.startsWith("../") ||
            request.request.startsWith("./")
          ) {
            try {
              // Use path.dirname to get the directory of the importer file
              const importerDir = path.dirname(request.path);
              const absolutePath = normalizeModulePath(
                request.request,
                importerDir,
                { absolute: true, osify: "fileUrl" },
              );
              debug(
                `[${resolveId}] Normalized relative import to absolute path:`,
                absolutePath,
              );
              return runPluginProcessing().catch((e) => {
                debug(`[${resolveId}] Error in plugin processing`, e.message);
                callback();
              });
            } catch (e) {
              debug(`[${resolveId}] Error normalizing relative import:`, e);
              return callback(e);
            }
          } else {
            // For non-relative imports, process them directly
            return runPluginProcessing().catch((e) => {
              debug(`[${resolveId}] Error in plugin processing`, e.message);
              callback();
            });
          }
        },
      );
  }
}

const mapAlias = (
  alias: Record<string, string> | Alias[],
): ResolveOptions["alias"] => {
  const mappedAlias: NonNullable<ResolveOptions["alias"]> = {};

  if (Array.isArray(alias)) {
    // Handle array format: { find: string | RegExp, replacement: string }
    for (const { find, replacement } of alias) {
      if (find instanceof RegExp) {
        // For RegExp, use the source as-is
        mappedAlias[find.source] = replacement;
      } else {
        // For string aliases, use them as-is without modification
        mappedAlias[find] = replacement;
      }
    }
  } else {
    // Handle object format: { [find: string]: replacement }
    for (const [find, replacement] of Object.entries(alias)) {
      // Use the alias key as-is without modification
      mappedAlias[find] = replacement;
    }
  }

  return mappedAlias;
};

export const mapViteResolveToEnhancedResolveOptions = (
  viteConfig: ResolvedConfig,
  envName: string,
): ResolveOptions => {
  const env = viteConfig.environments[envName];

  if (!env) {
    throw new Error(
      `Could not find environment configuration for "${envName}".`,
    );
  }

  const envResolveOptions = (env.resolve || {}) as typeof viteConfig.resolve;

  // Merge root config aliases with environment-specific aliases
  const mergedAlias = {
    ...(viteConfig.resolve?.alias ? mapAlias(viteConfig.resolve.alias) : {}),
    ...(envResolveOptions.alias ? mapAlias(envResolveOptions.alias) : {}),
  };

  // Use comprehensive extensions list similar to Vite's defaults
  const extensions = envResolveOptions.extensions || [
    ".mjs",
    ".js",
    ".mts",
    ".ts",
    ".jsx",
    ".tsx",
    ".json",
  ];

  const baseOptions: ResolveOptions = {
    // File system is required by enhanced-resolve.
    fileSystem: fs,
    // Map Vite's resolve options to enhanced-resolve's options.
    alias: Object.keys(mergedAlias).length > 0 ? mergedAlias : undefined,
    conditionNames: envResolveOptions.conditions,
    mainFields: envResolveOptions.mainFields,
    extensions,
    symlinks: envResolveOptions.preserveSymlinks,
    // Add default node modules resolution.
    modules: ["node_modules"],
    roots: [viteConfig.root],
  };

  return baseOptions;
};

export const createViteAwareResolver = (
  viteConfig: ResolvedConfig,
  environment: Environment,
) => {
  const baseOptions = mapViteResolveToEnhancedResolveOptions(
    viteConfig,
    environment.name,
  );

  // Add Vite plugin resolver if environment is provided
  const plugins = environment
    ? [new VitePluginResolverPlugin(environment)]
    : [];

  const enhancedResolveOptions: ResolveOptions = {
    ...baseOptions,
    plugins,
  };

  debug("Creating enhanced-resolve with options:", {
    extensions: enhancedResolveOptions.extensions,
    alias: enhancedResolveOptions.alias,
    roots: enhancedResolveOptions.roots,
  });

  return resolve.create(enhancedResolveOptions);
};
