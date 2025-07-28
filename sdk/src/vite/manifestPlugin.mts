import { readFile } from "node:fs/promises";
import { type Plugin } from "vite";

const virtualModuleId = "virtual:manifest.js";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

export const manifestPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => {
  let isBuild = false;

  return {
    name: "rwsdk:manifest",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        if (!isBuild) {
          return `export default {}`;
        }

        const manifestContent = await readFile(manifestPath, "utf-8");
        return `export default ${manifestContent}`;
      }
    },
  };
};
