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
        async (request: any, resolveContext: any, callback: any) => {
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

          for (const plugin of plugins) {
            // Handle different plugin formats - some have resolveId as a function, others as an object
            const resolveIdHandler = plugin.resolveId;
            if (!resolveIdHandler) continue;

            try {
              let result;

              // Debug the plugin structure to understand what we're dealing with
              debug(
                "Plugin %s has resolveId type: %s",
                plugin.name,
                typeof resolveIdHandler,
              );

              // Check if it's a function or an object with handler
              if (typeof resolveIdHandler === "function") {
                result = await resolveIdHandler.call(
                  pluginContext,
                  request.request,
                  request.path,
                  { scan: true, isEntry: false, attributes: {} },
                );
              } else if (
                resolveIdHandler &&
                typeof resolveIdHandler === "object"
              ) {
                // Handle object format - check for handler property
                debug(
                  "Plugin %s object keys: %s",
                  plugin.name,
                  Object.keys(resolveIdHandler),
                );

                if (
                  resolveIdHandler.handler &&
                  typeof resolveIdHandler.handler === "function"
                ) {
                  result = await resolveIdHandler.handler.call(
                    pluginContext,
                    request.request,
                    request.path,
                    { scan: true, isEntry: false, attributes: {} },
                  );
                } else {
                  // Skip plugins with unsupported resolveId object format
                  debug(
                    "Plugin %s has unsupported resolveId object format",
                    plugin.name,
                  );
                  continue;
                }
              } else {
                // Skip plugins with unsupported resolveId format
                debug(
                  "Plugin %s has unsupported resolveId format: %s",
                  plugin.name,
                  typeof resolveIdHandler,
                );
                continue;
              }

              if (result) {
                debug("Plugin %s returned result:", plugin.name, result);
                const resolvedId =
                  typeof result === "string" ? result : result.id;
                if (resolvedId) {
                  debug(
                    "Plugin %s resolved %s -> %s",
                    plugin.name,
                    request.request,
                    resolvedId,
                  );
                  return callback(null, {
                    ...request,
                    path: resolvedId,
                  });
                } else if (typeof result === "object" && result.id === null) {
                  // Plugin explicitly returned null, skip to next plugin
                  continue;
                } else if (
                  typeof result === "object" &&
                  result.mappedId &&
                  !result.resolved
                ) {
                  // Plugin (like vite-tsconfig-paths) mapped the alias but didn't resolve to a file
                  // Update the request with the mapped path and continue resolution
                  debug(
                    "Plugin %s mapped %s -> %s, continuing resolution",
                    plugin.name,
                    request.request,
                    result.mappedId,
                  );
                  request = {
                    ...request,
                    request: result.mappedId,
                  };
                  // Don't return yet, let enhanced-resolve handle extension resolution
                }
              }
            } catch (e) {
              debug(
                "Plugin %s failed to resolve %s: %s",
                plugin.name,
                request.request,
                (e as any)?.stack || (e as any)?.message || e,
              );
              // Continue to next plugin
            }
          }

          // No plugin could resolve, continue with normal resolution
          callback();
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
