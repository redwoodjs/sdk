import path from "node:path";
import type { Plugin } from "vite";
import {
  WORKER_SSR_BRIDGE_PATH,
  WORKER_CLIENT_LOOKUP_PATH,
  WORKER_SERVER_LOOKUP_PATH,
  WORKER_MANIFEST_PATH,
  WORKER_OUTPUT_DIR,
} from "../lib/constants.mjs";
import debug from "debug";

const log = debug("rwsdk:vite:linker-plugin");

const VIRTUAL_ENTRY_ID = "virtual:linker-entry";

export const linkerPlugin = (): Plugin => {
  let manifest: Record<string, any> | undefined;

  return {
    name: "rwsdk:linker",
    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return `\0${VIRTUAL_ENTRY_ID}`;
      }
    },
    load(id) {
      if (id === `\0${VIRTUAL_ENTRY_ID}`) {
        log("Loading virtual linker entry");

        const workerPath = "./worker.js";
        const ssrBridgePath = `./${path.basename(WORKER_SSR_BRIDGE_PATH)}`;
        const clientLookupPath = `./${path.basename(WORKER_CLIENT_LOOKUP_PATH)}`;
        const serverLookupPath = `./${path.basename(WORKER_SERVER_LOOKUP_PATH)}`;
        const manifestPath = `./${path.basename(WORKER_MANIFEST_PATH)}`;

        return `
          import manifest from '${manifestPath}' assert { type: 'json' };
          import '${workerPath}';
          import '${ssrBridgePath}';
          import '${clientLookupPath}';
          import '${serverLookupPath}';

          globalThis.__rw_manifest = manifest;
        `;
      }
    },
    renderChunk(code, chunk) {
      if (chunk.facadeModuleId?.endsWith(VIRTUAL_ENTRY_ID)) {
        log("Rendering final worker chunk");
        let newCode = code;

        if (!manifest) {
          try {
            const manifestContent = this.getModuleInfo(
              path.resolve(
                WORKER_OUTPUT_DIR,
                path.basename(WORKER_MANIFEST_PATH),
              ),
            )?.meta?.vite?.manifest;
            if (manifestContent) {
              manifest = manifestContent;
            }
          } catch (e) {
            const manifestImport = /const manifest = (\{.*\});/.exec(newCode);
            if (manifestImport?.[1]) {
              manifest = JSON.parse(manifestImport[1]);
            }
          }
        }

        if (!manifest) {
          this.warn(
            "Client manifest not found in linker plugin. Asset paths will not be replaced.",
          );
          return null;
        }

        log("Replacing asset placeholders in final worker bundle");
        for (const [key, value] of Object.entries(manifest)) {
          newCode = newCode.replaceAll(
            `rwsdk_asset:${key}`,
            `/${(value as { file: string }).file}`,
          );
        }

        newCode = newCode.replace(/globalThis\.__rw_manifest = manifest;/, "");

        return {
          code: newCode,
          map: null,
        };
      }

      return null;
    },
  };
};
