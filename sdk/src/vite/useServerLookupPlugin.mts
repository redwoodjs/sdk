import { createDirectiveLookupPlugin } from "./createDirectiveLookupPlugin.mjs";
import { Plugin } from "vite";

export const useServerLookupPlugin = ({
  projectRootDir,
  serverFiles,
}: {
  projectRootDir: string;
  serverFiles: Set<string>;
}): Plugin => {
  return createDirectiveLookupPlugin({
    projectRootDir,
    files: serverFiles,
    config: {
      kind: "server",
      directive: "use server",
      virtualModuleName: "virtual:use-server-lookup",
      exportName: "__server_lookup",
      pluginName: "use-server-lookup",
      optimizeForEnvironments: ["worker", "ssr"],
    },
  });
};
