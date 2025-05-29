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
  } else {
    // context(justinvdm, 2025-05-29): The cloning here is necessary:
    // vite (6.2.6) environments appear to be sharing the same alias
    // array instance.
    return (config.resolve.alias = [...config.resolve.alias]);
  }

  return config.resolve.alias as Alias[];
};
