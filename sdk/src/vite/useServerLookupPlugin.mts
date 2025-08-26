import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";
import { BuildState } from "./redwoodPlugin.mjs";

export const useServerLookupPlugin = async ({
  projectRootDir,
  buildState,
}: {
  projectRootDir: string;
  buildState: BuildState;
}): Promise<Plugin> => {
  const plugin = await createDirectiveLookupPlugin({
    projectRootDir,
    files: buildState.serverComponentPaths,
    config: {
      kind: "server",
      directive: "use server",
      virtualModuleName: "virtual:use-server-lookup",
      exportName: "useServerLookup",
      pluginName: "use-server-lookup",
      optimizeForEnvironments: ["ssr", "worker"],
    },
  });

  return {
    ...plugin,
    name: "rwsdk:use-server-lookup-wrapper", // Wrapper name
    rwsdk: {
      buildState,
    },
  };
};
