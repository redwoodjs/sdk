import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";
import { BuildState } from "./redwoodPlugin.mjs";

export const useClientLookupPlugin = async ({
  projectRootDir,
  buildState,
}: {
  projectRootDir: string;
  buildState: BuildState;
}): Promise<Plugin> => {
  const plugin = await createDirectiveLookupPlugin({
    projectRootDir,
    files: buildState.clientComponentPaths,
    config: {
      kind: "client",
      directive: "use client",
      virtualModuleName: "virtual:use-client-lookup",
      exportName: "useClientLookup",
      pluginName: "use-client-lookup",
      optimizeForEnvironments: ["ssr", "client"],
    },
  });

  return {
    ...plugin,
    name: "rwsdk:use-client-lookup-wrapper", // Wrapper name
    rwsdk: {
      buildState,
    },
  };
};
