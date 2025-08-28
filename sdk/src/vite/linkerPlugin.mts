import path from "node:path";
import fsp from "node:fs/promises";
import type { Plugin } from "vite";
import {
  WORKER_SSR_BRIDGE_PATH,
  WORKER_OUTPUT_DIR,
  CLIENT_MANIFEST_RELATIVE_PATH,
} from "../lib/constants.mjs";
import debug from "debug";

const log = debug("rwsdk:vite:linker-plugin");

const VIRTUAL_ENTRY_ID = "virtual:linker-entry";

export const linkerPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  let manifest: Record<string, any> | undefined;

  return {
    name: "rwsdk:linker",
    applyToEnvironment(environment) {
      if (environment.name === "linker") {
        return true;
      }
      return false;
    },
    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return `\0${VIRTUAL_ENTRY_ID}`;
      }
    },
    load(id) {
      if (id === `\0${VIRTUAL_ENTRY_ID}`) {
        log("Loading virtual linker entry");

        const workerPath = path.resolve(WORKER_OUTPUT_DIR, "worker.js");
        const ssrBridgePath = WORKER_SSR_BRIDGE_PATH;

        return `
          import '${workerPath}';
          import '${ssrBridgePath}';
        `;
      }
    },
    async renderChunk(code, chunk) {
      if (chunk.facadeModuleId?.endsWith(VIRTUAL_ENTRY_ID)) {
        log("Rendering final worker chunk");
        let newCode = code;

        // Read the manifest from the filesystem.
        const manifestContent = await fsp.readFile(
          path.resolve(projectRootDir, CLIENT_MANIFEST_RELATIVE_PATH),
          "utf-8",
        );

        const manifest = JSON.parse(manifestContent);

        // 1. Replace the manifest placeholder with the actual manifest content.
        log("Injecting manifest into worker bundle");
        newCode = newCode.replace(
          '"__RWSDK_MANIFEST_PLACEHOLDER__"',
          manifestContent,
        );

        // 2. Replace asset placeholders with their final hashed paths.
        log("Replacing asset placeholders in final worker bundle");
        for (const [key, value] of Object.entries(manifest)) {
          newCode = newCode.replaceAll(
            `rwsdk_asset:${key}`,
            `/${(value as { file: string }).file}`,
          );
        }

        return {
          code: newCode,
          map: null,
        };
      }

      return null;
    },
  };
};
