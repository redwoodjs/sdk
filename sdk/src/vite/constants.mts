import { builtinModules } from "node:module";

export const cloudflareBuiltInModules = [
  "cloudflare:email",
  "cloudflare:sockets",
  "cloudflare:workers",
  "cloudflare:workflows",
];

export const externalModules = [
  ...cloudflareBuiltInModules,
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export const externalModulesSet = new Set(externalModules);

/**
 * The Vite environment names that RedwoodSDK owns and configures.
 * Other environments (e.g. auxiliary workers created by the Cloudflare Vite
 * plugin) should not receive RSC-specific directive/barrel setup.
 */
export const SDK_ENVIRONMENT_NAMES = ["client", "ssr", "worker"] as const;
