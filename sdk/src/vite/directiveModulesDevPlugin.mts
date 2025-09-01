import { Plugin } from "vite";
import debug from "debug";

const log = debug("rwsdk:vite:directive-modules-dev");

export const VIRTUAL_CLIENT_BARREL_ID = "virtual:rwsdk:client-module-barrel";
export const VIRTUAL_SERVER_BARREL_ID = "virtual:rwsdk:server-module-barrel";

export const directiveModulesDevPlugin = ({
  clientFiles,
  serverFiles,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
}): Plugin => {
  return {
    name: "rwsdk:directive-modules-dev",
    enforce: "pre",
    resolveId(id) {
      if (id === VIRTUAL_CLIENT_BARREL_ID || id === VIRTUAL_SERVER_BARREL_ID) {
        return `\0${id}`;
      }
      return null;
    },
    load(id) {
      const generateBarrelContent = (files: Set<string>) => {
        const imports = [...files]
          .filter((file) => file.includes("node_modules"))
          .map((file, i) => `import * as M${i} from '${file}';`)
          .join("\n");

        const exports =
          "export default {\n" +
          [...files]
            .filter((file) => file.includes("node_modules"))
            .map((file, i) => `  '${file}': M${i},`)
            .join("\n") +
          "\n};";

        return `${imports}\n\n${exports}`;
      };

      if (id === `\0${VIRTUAL_CLIENT_BARREL_ID}`) {
        const barrelContent = generateBarrelContent(clientFiles);
        log("Generated client barrel content:\n%s", barrelContent);
        return {
          code: barrelContent,
          moduleSideEffects: false,
        };
      }

      if (id === `\0${VIRTUAL_SERVER_BARREL_ID}`) {
        const barrelContent = generateBarrelContent(serverFiles);
        log("Generated server barrel content:\n%s", barrelContent);
        return {
          code: barrelContent,
          moduleSideEffects: false,
        };
      }

      return null;
    },
  };
};
