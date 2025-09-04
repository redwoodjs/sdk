import resolve, { ResolveOptions } from "enhanced-resolve";
import { Alias, ResolvedConfig } from "vite";
import fs from "fs";

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
  console.log("###### envResolveOptions", envResolveOptions);
  console.log("###### viteConfig.resolve", viteConfig.resolve);

  // Merge root config aliases with environment-specific aliases
  const mergedAlias = {
    ...(viteConfig.resolve?.alias ? mapAlias(viteConfig.resolve.alias) : {}),
    ...(envResolveOptions.alias ? mapAlias(envResolveOptions.alias) : {}),
  };

  return {
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
};

export const createViteAwareResolver = (
  viteConfig: ResolvedConfig,
  envName: string,
) => {
  const enhancedResolveOptions = mapViteResolveToEnhancedResolveOptions(
    viteConfig,
    envName,
  );
  const { fileSystem: _fs, ...rest } = enhancedResolveOptions;
  console.log("###### enhancedResolveOptions", rest);
  return resolve.create(enhancedResolveOptions);
};
