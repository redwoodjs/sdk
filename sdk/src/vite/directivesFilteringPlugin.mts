import debug from "debug";
import { Plugin } from "vite";

import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:directives-filtering-plugin");

export const directivesFilteringPlugin = ({
  clientFiles,
  serverFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:directives-filtering",
    enforce: "post",
    async buildEnd() {
      if (
        this.environment.name !== "worker" ||
        process.env.RWSDK_BUILD_PASS !== "worker"
      ) {
        return;
      }

      log("Filtering directive modules after worker build...");

      process.env.VERBOSE &&
        log(
          "Directive modules before filtering: client=%O, server=%O",
          Array.from(clientFiles),
          Array.from(serverFiles),
        );

      [clientFiles, serverFiles].forEach((files) => {
        for (const id of files) {
          const absoluteId = normalizeModulePath(id, projectRootDir, {
            absolute: true,
          });
          const info = this.getModuleInfo(absoluteId);

          if (!info?.isIncluded) {
            files.delete(id);
          }
        }
      });

      process.env.VERBOSE &&
        log(
          "Client/server files after filtering: client=%O, server=%O",
          Array.from(clientFiles),
          Array.from(serverFiles),
        );
    },
  };
};
