import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";
import { WORKER_CLIENT_LOOKUP_PATH } from "../lib/constants.mjs";

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
      finalOutputPath: WORKER_CLIENT_LOOKUP_PATH,
    },
  });
};
