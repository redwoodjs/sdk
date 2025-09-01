import { Plugin } from "vite";
import debug from "debug";

import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:directive-modules-build");

export const directiveModulesBuildPlugin = ({
  clientFiles,
  serverFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:directive-modules-build",
    enforce: "post",
    async buildEnd() {
      if (this.environment.name !== "worker") {
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
