import debug from "debug";
import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import {
  DIST_DIR,
  RUNTIME_DIR,
  RW_STATE_EXPORT_PATH,
} from "../lib/constants.mjs";

const log = debug("rwsdk:vite:state-plugin");
const VIRTUAL_STATE_PREFIX = "virtual:rwsdk:state:";

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
              {
                // context(justinvdm, 13 Oct 2025): Vite dep optimizer slugifies the export path
                filter: new RegExp(
                  `^(${RW_STATE_EXPORT_PATH}|${VIRTUAL_STATE_PREFIX}.*)$`,
                ),
              },
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
          return `${VIRTUAL_STATE_PREFIX}${id}`;
        } else {
          return path.resolve(RUNTIME_DIR, "state.mjs");
        }
      }
    },
    async load(id) {
      if (id.startsWith(VIRTUAL_STATE_PREFIX)) {
        const stateModulePath = path.resolve(DIST_DIR, "runtime", "state.mjs");
        log("Loading virtual state module from %s", stateModulePath);
        return await fs.readFile(stateModulePath, "utf-8");
      }
    },
  };
};
