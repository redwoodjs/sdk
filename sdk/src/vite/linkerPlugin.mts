import path from "node:path";
import fsp from "node:fs/promises";
import type { Plugin } from "vite";
import { CLIENT_MANIFEST_RELATIVE_PATH } from "../lib/constants.mjs";
import debug from "debug";

const log = debug("rwsdk:vite:linker-plugin");

export const linkerPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:linker",
    applyToEnvironment(environment) {
      return environment.name === "linker";
    },
    async renderChunk(code) {
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
    },
  };
};
