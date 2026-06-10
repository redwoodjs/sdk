import debug from "debug";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { CLIENT_VERSION_QUERY } from "../runtime/lib/stale.js";
import { CLIENT_MANIFEST_RELATIVE_PATH } from "../lib/constants.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:linker-plugin");

function appendBuildVersionQuery(
  assetPath: string,
  buildId: string | undefined,
): string {
  if (!buildId) {
    return assetPath;
  }

  const url = new URL(assetPath, "http://rwsdk.local");
  url.searchParams.set(CLIENT_VERSION_QUERY, buildId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function linkWorkerBundle({
  code,
  manifestContent,
  projectRootDir,
  base,
}: {
  code: string;
  manifestContent: string;
  projectRootDir: string;
  base?: string;
}) {
  const buildId = process.env.VITE_RWSDK_BUILD_ID;
  let newCode = code;
  const manifest = JSON.parse(manifestContent);

  // 1. Replace the manifest placeholder with the actual manifest content.
  log("Injecting manifest into worker bundle");
  newCode = newCode.replace(
    /['"]__RWSDK_MANIFEST_PLACEHOLDER__['"]/,
    manifestContent,
  );

  // 2. Replace asset placeholders with their final hashed paths.
  log("Replacing asset placeholders in final worker bundle");
  for (const [key, value] of Object.entries(manifest)) {
    const normalizedKey = normalizeModulePath(key, projectRootDir, {
      isViteStyle: false,
    });

    // If base is provided, prepend it with the final hashed path.
    // Base is assumed to have a trailing "/".
    const assetPath = (base ? base : "/") + (value as { file: string }).file;
    const assetUrl = appendBuildVersionQuery(assetPath, buildId);

    newCode = newCode.replaceAll(`rwsdk_asset:${normalizedKey}`, assetUrl);
  }

  // 3. Deprefix any remaining placeholders that were not in the manifest.
  // This handles public assets that don't go through the bundler.
  // context(justinvdm, 17 Mar 2026): Prepend base (without trailing slash)
  // so public asset paths are correct under a non-default base.
  log("Deprefixing remaining asset placeholders");
  const basePrefix = (base ? base : "/").replace(/\/$/, "");
  newCode = newCode.replaceAll("rwsdk_asset:", basePrefix);

  return {
    code: newCode,
    map: null,
  };
}

export const linkerPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  let config: ResolvedConfig;

  return {
    name: "rwsdk:linker",

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async renderChunk(code) {
      if (
        this.environment.name !== "worker" ||
        process.env.RWSDK_BUILD_PASS !== "linker"
      ) {
        return null;
      }

      log("Rendering final worker chunk");
      const manifestContent = await fsp.readFile(
        path.resolve(projectRootDir, CLIENT_MANIFEST_RELATIVE_PATH),
        "utf-8",
      );

      const result = linkWorkerBundle({
        code,
        manifestContent,
        projectRootDir,
        base: config.base,
      });

      log("Final worker chunk rendered");
      return result;
    },
  };
};
