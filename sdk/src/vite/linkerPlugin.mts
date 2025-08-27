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

        // These paths are relative to the WORKER_OUTPUT_DIR, which is the
        // root for the linker build.
        const workerPath = "./worker.js";
        const ssrBridgePath = `./${path.basename(WORKER_SSR_BRIDGE_PATH)}`;
        const clientLookupPath = `./${path.basename(WORKER_CLIENT_LOOKUP_PATH)}`;
        const serverLookupPath = `./${path.basename(WORKER_SERVER_LOOKUP_PATH)}`;
        const manifestPath = `./${path.basename(WORKER_MANIFEST_PATH)}`;

        // This barrel file imports all the necessary artifacts.
        // Vite will bundle these into a single output.
        return `
          import manifest from '${manifestPath}' assert { type: 'json' };
          import '${workerPath}';
          import '${ssrBridgePath}';
          import '${clientLookupPath}';
          import '${serverLookupPath}';

          // We don't actually DO anything with the manifest here, but by
          // importing it, we make it available to the renderChunk hook below.
          globalThis.__rw_manifest = manifest;
        `;
      }
    },
    renderChunk(code, chunk) {
      if (chunk.facadeModuleId?.endsWith(VIRTUAL_ENTRY_ID)) {
        log("Rendering final worker chunk");
        let newCode = code;

        // The manifest is loaded into the bundle via the virtual entry,
        // but Vite might tree-shake it out. We need to get it.
        // A simple way is to read it from the filesystem.
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
            // Fallback for getting manifest if getModuleInfo doesn't work
            // This is a bit of a hack, but it's reliable.
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

        // Clean up the temporary manifest assignment
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
