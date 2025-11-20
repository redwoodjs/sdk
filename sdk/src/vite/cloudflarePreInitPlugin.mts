import type { Plugin } from "vite";

/**
 * Plugin that performs initialization workarounds that must run before
 * the Cloudflare plugin's `configureServer` hook executes.
 *
 * Cloudflare plugin v1.15.0 executes the worker entry file during
 * `configureServer` to detect exports, which triggers SSR code evaluation
 * before normal server initialization completes. This plugin ensures
 * required systems are initialized beforehand.
 */
export const cloudflarePreInitPlugin = (): Plugin => {
  return {
    name: "rwsdk:cloudflare-pre-init",
    // context(justinvdm, 20 Jan 2025): This plugin must run before the
    // Cloudflare plugin's `configureServer` hook. The Cloudflare plugin
    // executes the worker entry file during `configureServer` to detect
    // exports, and blocks the rest of the configureServer plugins until the
    // request is complete. We must initialize required systems (SSR dependency
    // optimizer + our own plugins to them, as well as CSS plugin's moduleCache)
    // before this happens to prevent errors.
    enforce: "pre",

    async configureServer(server) {
      // context(justinvdm, 20 Jan 2025): Initialize SSR dependency optimizer before
      // Cloudflare plugin triggers SSR code evaluation. This ensures dependencies
      // in `optimizeDeps.include` (like `react-dom/server.edge`) are correctly
      // registered before they are discovered lazily.
      if (server.environments.ssr?.depsOptimizer) {
        await server.environments.ssr.depsOptimizer.init();
      }

      // context(justinvdm, 20 Jan 2025): Initialize CSS plugin's shared moduleCache
      // before CSS modules are processed. The Cloudflare plugin's export detection
      // can trigger CSS module processing in the SSR environment during `configureServer`,
      // which happens before `initServer` runs. Vite's CSS plugin uses a shared
      // `moduleCache` that is initialized in the client environment's `buildStart` hook.
      // By calling `buildStart` here (which is idempotent), we ensure the CSS plugin's
      // cache is initialized before CSS modules are processed, preventing "Cannot read
      // properties of undefined (reading 'set')" errors.
      await server.environments.client.pluginContainer.buildStart();
    },
  };
};
