import createDebug from "debug";
import resolve, { ResolveOptions } from "enhanced-resolve";
import fs from "fs";
import path from "path";
import { Alias, Environment, ResolvedConfig } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
const debug = createDebug("rwsdk:vite:enhanced-resolve-plugin");

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
            debug(
              "Available plugins:",
              plugins.map((p: any) => p.name),
            );

            for (const plugin of plugins) {
              const resolveIdHandler = plugin.resolveId;
              if (!resolveIdHandler) continue;

              let handlerFn: Function | undefined;
              let shouldApplyFilter = false;
              let filter: {
                id?:
                  | string
                  | RegExp
                  | Array<string | RegExp>
                  | {
                      include?: string | RegExp | Array<string | RegExp>;
                      exclude?: string | RegExp | Array<string | RegExp>;
                    };
              } | null = null;

              if (typeof resolveIdHandler === "function") {
                handlerFn = resolveIdHandler;
              } else if (
                typeof resolveIdHandler === "object" &&
                typeof resolveIdHandler.handler === "function"
              ) {
                handlerFn = resolveIdHandler.handler;
                shouldApplyFilter = true;
                filter = resolveIdHandler.filter;
              }

              if (!handlerFn) continue;

              if (shouldApplyFilter && filter?.id) {
                const idFilter = filter.id;
                let shouldSkip = false;

                if (idFilter instanceof RegExp) {
                  shouldSkip = !idFilter.test(currentRequest.request);
                } else if (Array.isArray(idFilter)) {
                  // Handle array of filters - matches if ANY filter matches
                  shouldSkip = !idFilter.some((f: string | RegExp) =>
                    f instanceof RegExp
                      ? f.test(currentRequest.request)
                      : f === currentRequest.request,
                  );
                } else if (typeof idFilter === "string") {
                  shouldSkip = idFilter !== currentRequest.request;
                } else if (typeof idFilter === "object" && idFilter !== null) {
                  // Handle include/exclude object pattern
                  const { include, exclude } = idFilter;
                  let matches = true;

                  // Check include patterns (if any)
                  if (include) {
                    const includePatterns = Array.isArray(include)
                      ? include
                      : [include];
                    matches = includePatterns.some(
                      (pattern: string | RegExp) =>
                        pattern instanceof RegExp
                          ? pattern.test(currentRequest.request)
                          : pattern === currentRequest.request,
                    );
                  }

                  // Check exclude patterns (if any) - exclude overrides include
                  if (matches && exclude) {
                    const excludePatterns = Array.isArray(exclude)
                      ? exclude
                      : [exclude];
                    const isExcluded = excludePatterns.some(
                      (pattern: string | RegExp) =>
                        pattern instanceof RegExp
                          ? pattern.test(currentRequest.request)
                          : pattern === currentRequest.request,
                    );
                    matches = !isExcluded;
                  }

                  shouldSkip = !matches;
                }

                if (shouldSkip) {
                  debug(
                    "Skipping plugin '%s' due to filter mismatch for '%s'",
                    plugin.name,
                    currentRequest.request,
                  );
                  continue;
                }
              }

              try {
                debug(
                  "Calling plugin '%s' for '%s'",
                  plugin.name,
                  currentRequest.request,
                );

                const result = await handlerFn.call(
                  pluginContext,
                  currentRequest.request,
                  currentRequest.path,
                  { scan: true },
                );

                debug("Plugin '%s' returned:", plugin.name, result);

                if (!result) continue;

                const resolvedId =
                  typeof result === "string" ? result : result.id;

                if (resolvedId && resolvedId !== currentRequest.request) {
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
                } else if (resolvedId === currentRequest.request) {
                  debug(
                    "Plugin '%s' returned unchanged ID, continuing to next plugin",
                    plugin.name,
                  );
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

            // For absolute paths, check if the file exists
            if (path.isAbsolute(currentRequest.request)) {
              try {
                if (fs.existsSync(currentRequest.request)) {
                  debug(
                    "File exists, resolving to: %s",
                    currentRequest.request,
                  );
                  return callback(null, {
                    ...currentRequest,
                    path: currentRequest.request,
                  });
                }
              } catch (e) {
                debug(
                  "Error checking file existence: %s",
                  (e as Error).message,
                );
              }
            }

            callback();
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
                { absolute: true },
              );
              debug("Absolutified %s -> %s", request.request, absolutePath);

              const absoluteRequest = { ...request, request: absolutePath };
              runPluginProcessing(absoluteRequest).catch((e) => {
                debug("Error in plugin processing: %s", e.message);
                callback();
              });
            } catch (e) {
              debug(
                "Failed to absolutify %s: %s",
                request.request,
                (e as Error).message,
              );
              callback();
            }
          } else {
            // For non-relative imports, process them directly
            runPluginProcessing(request).catch((e) => {
              debug("Error in plugin processing: %s", e.message);
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
