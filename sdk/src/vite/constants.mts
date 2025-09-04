import { builtinModules } from "node:module";

// port(justinvdm, 09 Jun 2025):
// https://github.com/cloudflare/workers-sdk/blob/d533f5ee7da69c205d8d5e2a5f264d2370fc612b/packages/vite-plugin-cloudflare/src/cloudflare-environment.ts#L123-L128
export const CLOUDFLARE_BUILT_IN_MODULES = [
  "cloudflare:email",
  "cloudflare:sockets",
  "cloudflare:workers",
  "cloudflare:workflows",
];

export const EXTERNAL_MODULES = [
  ...CLOUDFLARE_BUILT_IN_MODULES,
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];
