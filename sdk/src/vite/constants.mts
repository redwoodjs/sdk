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
