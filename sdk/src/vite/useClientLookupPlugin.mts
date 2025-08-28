import { resolve } from "node:path";

import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";

export const useClientLookupPlugin = ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}) => {
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
