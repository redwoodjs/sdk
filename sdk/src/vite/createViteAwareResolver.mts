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
      const key =
        find instanceof RegExp
          ? find.source
          : find.endsWith("$")
            ? find
            : `${find}/`;
      mappedAlias[key] = replacement;
    }
  } else {
    // Handle object format: { [find: string]: replacement }
    for (const [find, replacement] of Object.entries(alias)) {
      const key = find.endsWith("$") ? find : `${find}/`;
      mappedAlias[key] = replacement;
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

  const resolveOptions = (env.resolve || {}) as typeof viteConfig.resolve;

  return {
    // File system is required by enhanced-resolve.
    fileSystem: fs,
    // Map Vite's resolve options to enhanced-resolve's options.
    alias: resolveOptions.alias ? mapAlias(resolveOptions.alias) : undefined,
    conditionNames: resolveOptions.conditions,
    mainFields: resolveOptions.mainFields,
    extensions: resolveOptions.extensions,
    symlinks: resolveOptions.preserveSymlinks,
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
