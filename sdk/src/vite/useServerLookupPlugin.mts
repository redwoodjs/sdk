import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";
import { WORKER_SERVER_LOOKUP_PATH } from "../lib/constants.mjs";

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
      kind: "server",
      directive: "use server",
      virtualModuleName: "virtual:use-server-lookup",
      exportName: "useServerLookup",
      pluginName: "use-server-lookup",
      optimizeForEnvironments: ["ssr", "worker"],
      finalOutputPath: WORKER_SERVER_LOOKUP_PATH,
    },
  });
};
