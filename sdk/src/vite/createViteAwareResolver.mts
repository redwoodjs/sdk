import resolve, { ResolveOptions } from "enhanced-resolve";
import { Alias, ResolvedConfig } from "vite";
import fs from "fs";
import createDebug from "debug";

const debug = createDebug("rwsdk:vite:enhanced-resolve-plugin");

// Enhanced-resolve plugin that wraps Vite plugin resolution
class VitePluginResolverPlugin {
  private baseResolver: any;
  private viteConfig: ResolvedConfig;
  private envName: string;

  constructor(
    private environment: any,
    viteConfig: ResolvedConfig,
    envName: string,
    private source = "resolve",
    private target = "resolved",
  ) {
    this.viteConfig = viteConfig;
    this.envName = envName;
  }

  apply(resolver: any) {
    // Create a separate base resolver without our plugin to avoid circular calls
    const baseOptions = mapViteResolveToEnhancedResolveOptions(
      this.viteConfig,
      this.envName,
    );
    this.baseResolver = resolve.create(baseOptions);

    const target = resolver.ensureHook(this.target);
    resolver
      .getHook(this.source)
      .tapAsync(
        "VitePluginResolverPlugin",
        (request: any, resolveContext: any, callback: any) => {
          const plugins = this.environment?.plugins;
          if (!plugins) {
            return callback();
          }

          // Create a proper plugin context with resolve method
          const pluginContext = {
            environment: this.environment,
            resolve: async (id: string, importer?: string) => {
              // Use enhanced-resolve with full extension resolution capabilities
              // This allows vite-tsconfig-paths to properly resolve mapped paths
              // Return format matches Vite's resolveId result: { id: string } | null
              return new Promise<{ id: string } | null>((resolve) => {
                this.baseResolver(
                  {},
                  importer || this.environment.config.root,
                  id,
                  {},
                  (err: any, result: any) => {
                    if (!err && result) {
                      debug("Context resolve: %s -> %s", id, result);
                      resolve({ id: result });
                    } else {
                      debug(
                        "Context resolve failed for %s: %s",
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

          debug("Trying to resolve %s from %s", request.request, request.path);

          // This function encapsulates the logic to process Vite plugins for a given request.
          const runPluginProcessing = async (currentRequest: any) => {
            for (const plugin of plugins) {
              const resolveIdHandler = plugin.resolveId;
              if (!resolveIdHandler) continue;

              let handlerFn: Function | undefined;
              if (typeof resolveIdHandler === "function") {
                handlerFn = resolveIdHandler;
              } else if (
                typeof resolveIdHandler === "object" &&
                typeof resolveIdHandler.handler === "function"
              ) {
                handlerFn = resolveIdHandler.handler;
              }

              if (!handlerFn) continue;

              try {
                const result = await handlerFn.call(
                  pluginContext,
                  currentRequest.request,
                  currentRequest.path,
                  { scan: true },
                );

                if (!result) continue;

                const resolvedId =
                  typeof result === "string" ? result : result.id;

                if (resolvedId) {
                  debug(
                    "Plugin '%s' resolved '%s' -> '%s'",
                    plugin.name,
                    currentRequest.request,
                    resolvedId,
                  );
                  return callback(null, {
                    ...currentRequest,
                    path: resolvedId,
                  });
                }
              } catch (e) {
                debug(
                  "Plugin '%s' failed while resolving '%s': %s",
                  plugin.name,
                  currentRequest.request,
                  (e as Error).message,
                );
              }
            }
            // If no plugin resolves, fall back to enhanced-resolve's default behavior
            debug(
              "No Vite plugin resolved '%s', falling back.",
              currentRequest.request,
            );
            callback();
          };

          // For relative imports, we first resolve them to an absolute path.
          // This aligns with Vite's behavior of normalizing paths before plugin processing.
          if (
            request.request.startsWith("../") ||
            request.request.startsWith("./")
          ) {
            debug(
              "Absolutifying relative import before plugin resolution: %s",
              request.request,
            );
            this.baseResolver(
              {},
              request.path,
              request.request,
              {},
              (err: any, result: any) => {
                if (err || !result) {
                  debug(
                    "Failed to absolutify %s: %s",
                    request.request,
                    err?.message || "not found",
                  );
                  // If we can't absolutify, we can't proceed.
                  return callback();
                }
                debug("Absolutified %s -> %s", request.request, result);
                // Now, run the Vite plugin pipeline with the newly absolutified path.
                const absoluteRequest = { ...request, request: result };
                runPluginProcessing(absoluteRequest).catch((e) => {
                  debug("Error in plugin processing: %s", e.message);
                  callback(); // Ensure we always call the callback on error
                });
              },
            );
          } else {
            // For non-relative imports, process them directly.
            runPluginProcessing(request).catch((e) => {
              debug("Error in plugin processing: %s", e.message);
              callback(); // Ensure we always call the callback on error
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
  envName: string,
  environment?: any, // Optional environment for plugin resolution
) => {
  const baseOptions = mapViteResolveToEnhancedResolveOptions(
    viteConfig,
    envName,
  );

  // Add Vite plugin resolver if environment is provided
  const plugins = environment
    ? [new VitePluginResolverPlugin(environment, viteConfig, envName)]
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
