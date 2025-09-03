import path from "node:path";
import fsp from "node:fs/promises";
import type { Plugin } from "vite";
import { CLIENT_MANIFEST_RELATIVE_PATH } from "../lib/constants.mjs";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:linker-plugin");

export const linkerPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:linker",
    async renderChunk(code) {
      if (
        this.environment.name !== "worker" ||
        process.env.RWSDK_BUILD_PASS !== "linker"
      ) {
        return null;
      }

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
        const normalizedKey = normalizeModulePath(key, projectRootDir, {
          isViteStyle: false,
        });

        newCode = newCode.replaceAll(
          `rwsdk_asset:${normalizedKey}`,
          `/${(value as { file: string }).file}`,
        );
      }

      // 3. Deprefix any remaining placeholders that were not in the manifest.
      // This handles public assets that don't go through the bundler.
      log("Deprefixing remaining asset placeholders");
      newCode = newCode.replaceAll("rwsdk_asset:", "");

      return {
        code: newCode,
        map: null,
      };
    },
  };
};
