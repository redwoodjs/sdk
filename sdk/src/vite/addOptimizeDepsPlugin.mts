import type { EnvironmentOptions } from "vite";

interface OptimizeDepsPlugin {
  name: string;
  resolveId?: (
    id: string,
    importer: string | undefined,
    opts: { kind: string },
  ) => any;
  load?: (id: string) => any;
}

export function addOptimizeDepsPlugin(
  config: EnvironmentOptions,
  plugin: OptimizeDepsPlugin,
): void {
  config.optimizeDeps ??= {};
  config.optimizeDeps.rolldownOptions ??= {};
  (config.optimizeDeps.rolldownOptions as any).plugins ??= [];
  ((config.optimizeDeps.rolldownOptions as any).plugins as any[]).push(plugin);
}
