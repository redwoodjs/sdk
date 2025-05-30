import type { Alias, UserConfig } from "vite";

export const ensureAliasArray = (config: UserConfig): Alias[] => {
  config.resolve ??= {};

  if (!config.resolve?.alias) {
    config.resolve.alias = [];
  } else if (!Array.isArray(config.resolve.alias)) {
    const existingAlias = config.resolve.alias;
    config.resolve.alias = Object.entries(existingAlias).map(
      ([find, replacement]) => ({ find, replacement }),
    );
  }

  return config.resolve.alias as Alias[];
};
