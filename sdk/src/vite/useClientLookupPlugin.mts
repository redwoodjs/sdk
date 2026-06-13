import { Plugin } from "vite";
import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";

// Legacy fallback for client-reference discovery.
// The preferred default path uses plugin-rsc metadata via
// viteRscClientReferencePlugin. Keep this plugin for explicit rollback and
// compatibility fixes only; add new client-reference behavior to the
// plugin-rsc adapter path instead.
export const useClientLookupPlugin = async ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}): Promise<Plugin> => {
  return createDirectiveLookupPlugin({
    projectRootDir,
    files: clientFiles,
    config: {
      kind: "client",
      directive: "use client",
      virtualModuleName: "virtual:use-client-lookup",
      exportName: "useClientLookup",
      pluginName: "use-client-lookup",
      optimizeForEnvironments: ["ssr", "client"],
    },
  });
};
