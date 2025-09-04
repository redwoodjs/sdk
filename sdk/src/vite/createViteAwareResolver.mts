import resolve, { ResolveOptions } from "enhanced-resolve";
import { Alias, ResolvedConfig } from "vite";
import fs from "fs";

// Enhanced-resolve plugin that wraps Vite plugin resolution
class VitePluginResolverPlugin {
  constructor(
    private environment: any,
    private source = "resolve",
    private target = "resolved",
  ) {}

  apply(resolver: any) {
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

          for (const plugin of plugins) {
            if (plugin.resolveId) {
              try {
                const result = await plugin.resolveId.call(
                  { environment: this.environment },
                  request.request,
                  request.path,
                  { scan: true, isEntry: false, attributes: {} },
                );
                if (result) {
                  const resolvedId =
                    typeof result === "string" ? result : result.id;
                  if (resolvedId) {
                    return callback(null, {
                      ...request,
                      path: resolvedId,
                    });
                  }
                }
              } catch (e) {
                // Continue to next plugin
              }
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

  const baseOptions: ResolveOptions = {
    // File system is required by enhanced-resolve.
    fileSystem: fs,
    // Map Vite's resolve options to enhanced-resolve's options.
    alias: Object.keys(mergedAlias).length > 0 ? mergedAlias : undefined,
    conditionNames: envResolveOptions.conditions,
    mainFields: envResolveOptions.mainFields,
    extensions: envResolveOptions.extensions,
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
    ? [new VitePluginResolverPlugin(environment)]
    : [];

  const enhancedResolveOptions: ResolveOptions = {
    ...baseOptions,
    plugins,
  };

  return resolve.create(enhancedResolveOptions);
};
