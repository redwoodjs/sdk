import type { UserConfig } from "vite";

export const ensureAliasArray = (config: { resolve?: any }) => {
  if (!Array.isArray(config.resolve?.alias)) {
    config.resolve ??= {};
    config.resolve.alias ??= [];
    config.resolve.alias = Object.entries(config.resolve.alias).map(
      ([find, replacement]) => ({ find, replacement }),
    );
  }

  return config.resolve.alias as {
    find: string | RegExp;
    replacement: string;
  }[];
};
