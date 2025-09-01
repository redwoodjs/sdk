import { Plugin } from "vite";
import debug from "debug";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

const log = debug("rwsdk:vite:directive-modules-dev");

export const VIRTUAL_CLIENT_BARREL_ID = "virtual:rwsdk:client-module-barrel";
export const VIRTUAL_SERVER_BARREL_ID = "virtual:rwsdk:server-module-barrel";

const barrelIds = [VIRTUAL_CLIENT_BARREL_ID, VIRTUAL_SERVER_BARREL_ID];

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
    configEnvironment(envName, envConfig) {
      if (envName === "client" || envName === "ssr") {
        log("Configuring environment: %s", envName);

        // This esbuild plugin is for the dependency optimizer
        const esbuildPlugin = {
          name: "rwsdk:directive-modules-dev-esbuild",
          setup(build: any) {
            build.onLoad(
              {
                filter: new RegExp(barrelIds.map((id) => `^${id}$`).join("|")),
              },
              (args: any) => {
                log("ESBuild loading %s", args.path);
                const files =
                  args.path === VIRTUAL_CLIENT_BARREL_ID
                    ? clientFiles
                    : serverFiles;
                const contents = generateBarrelContent(files);
                log("Generated barrel content for %s", args.path);
                return { contents, loader: "js" };
              },
            );
          },
        };

        // 1. Add alias for the dev server runtime
        const aliases = ensureAliasArray(envConfig);
        for (const barrelId of barrelIds) {
          const findRegex = new RegExp(
            `^${barrelId.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
          );
          aliases.push({
            find: findRegex,
            replacement: `\0${barrelId}`,
          });
          log("Added alias for env=%s: %s", envName, barrelId);
        }

        // 2. Add esbuild plugin for the dependency optimizer
        envConfig.optimizeDeps ??= {};
        envConfig.optimizeDeps.esbuildOptions ??= {};
        envConfig.optimizeDeps.esbuildOptions.plugins ??= [];
        envConfig.optimizeDeps.esbuildOptions.plugins.push(esbuildPlugin);
      }
    },
  };
};
