export const ensureConfigArrays = (config: any) => {
  config.optimizeDeps ??= {};
  config.optimizeDeps.include ??= [];
  config.optimizeDeps.esbuildOptions ??= {};
  config.optimizeDeps.esbuildOptions.plugins ??= [];
  config.resolve ??= {};
  (config.resolve as any).alias ??= [];
  if (!Array.isArray((config.resolve as any).alias)) {
    const aliasObj = (config.resolve as any).alias;
    (config.resolve as any).alias = Object.entries(aliasObj).map(
      ([find, replacement]) => ({ find, replacement }),
    );
  }
};
