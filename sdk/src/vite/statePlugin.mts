import debug from "debug";
import fs from "node:fs/promises";
import type { Plugin } from "vite";
import { RW_STATE_EXPORT_PATH } from "../lib/constants.mjs";
import { addOptimizeDepsPlugin } from "./addOptimizeDepsPlugin.mjs";
import { maybeResolveEnvImport } from "./envResolvers.mjs";

const log = debug("rwsdk:vite:state-plugin");
const VIRTUAL_STATE_PREFIX = "virtual:rwsdk:state:";

export const statePlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  let isDev = false;

  const stateModulePath = maybeResolveEnvImport({
    id: RW_STATE_EXPORT_PATH,
    envName: "worker",
    projectRootDir,
  });

  if (!stateModulePath) {
    throw new Error(
      `[rwsdk] State module path not found for project root: ${projectRootDir}. This is likely a bug in RedwoodSDK. Please report this issue at https://github.com/redwoodjs/sdk/issues/new`,
    );
  }

  return {
    name: "rwsdk:state",
    enforce: "pre",
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
    },
    configEnvironment(env, config) {
      if (env === "worker") {
        const stateFilter = new RegExp(
          `^(${RW_STATE_EXPORT_PATH}|${VIRTUAL_STATE_PREFIX}.*)$`,
        );

        addOptimizeDepsPlugin(config, {
          name: "rwsdk-state-external",
          resolveId(id: string) {
            if (stateFilter.test(id)) {
              log("Marking as external: %s", id);
              return { id, external: true };
            }
          },
        });
      }
    },
    resolveId(id) {
      if (id === RW_STATE_EXPORT_PATH) {
        if (isDev && this.environment.name === "worker") {
          return `${VIRTUAL_STATE_PREFIX}${id}`;
        } else {
          return stateModulePath;
        }
      }
    },
    async load(id) {
      if (id.startsWith(VIRTUAL_STATE_PREFIX)) {
        log("Loading virtual state module from %s", stateModulePath);
        return await fs.readFile(stateModulePath, "utf-8");
      }
    },
  };
};
