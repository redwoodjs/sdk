import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";

export const useServerLookupPlugin = async ({
  projectRootDir,
  serverFiles,
}: {
  projectRootDir: string;
  serverFiles: Set<string>;
}): Promise<Plugin> => {
  return createDirectiveLookupPlugin({
    projectRootDir,
    files: serverFiles,
    config: {
      directive: "use server",
      virtualModuleName: "virtual:use-server-lookup",
      exportName: "useServerLookup",
      pluginName: "use-server-lookup",
    },
  });
};
