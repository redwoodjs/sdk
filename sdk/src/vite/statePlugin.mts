import debug from "debug";
import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import {
  RUNTIME_DIR,
  RW_STATE_EXPORT_PATH,
  VIRTUAL_RW_STATE_PATH,
} from "../lib/constants.mjs";

const log = debug("rwsdk:vite:state-plugin");

export const statePlugin = (): Plugin => {
  let isDev = false;

  return {
    name: "rwsdk:state",
    enforce: "pre",
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
    },
    configEnvironment(env, config) {
      if (env === "worker") {
        config.optimizeDeps ??= {};
        config.optimizeDeps.esbuildOptions ??= {};
        config.optimizeDeps.esbuildOptions.plugins ??= [];
        config.optimizeDeps.esbuildOptions.plugins.push({
          name: "rwsdk-state-external",
          setup(build) {
            build.onResolve(
              { filter: new RegExp(`^${RW_STATE_EXPORT_PATH}$`) },
              (args) => {
                log("Marking as external: %s", args.path);
                return {
                  path: args.path,
                  external: true,
                };
              },
            );
          },
        });
      }
    },
    resolveId(id) {
      if (id === RW_STATE_EXPORT_PATH) {
        if (isDev && this.environment.name === "worker") {
          return VIRTUAL_RW_STATE_PATH;
        } else {
          return path.resolve(RUNTIME_DIR, "state.mjs");
        }
      }
    },
    async load(id) {
      if (id === VIRTUAL_RW_STATE_PATH) {
        const stateModulePath = path.resolve(RUNTIME_DIR, "state.mts");
        log("Loading virtual state module from %s", stateModulePath);
        return await fs.readFile(stateModulePath, "utf-8");
      }
    },
  };
};
