import { resolve } from "node:path";
import { InlineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { hasOwnCloudflareVitePlugin } from "./hasOwnCloudflareVitePlugin.mjs";

import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";
import { directivesPlugin } from "./directivesPlugin.mjs";
import { useClientLookupPlugin } from "./useClientLookupPlugin.mjs";
import { useServerLookupPlugin } from "./useServerLookupPlugin.mjs";
import { miniflareHMRPlugin } from "./miniflareHMRPlugin.mjs";
import { moveStaticAssetsPlugin } from "./moveStaticAssetsPlugin.mjs";
import { configPlugin } from "./configPlugin.mjs";
import { $ } from "../lib/$.mjs";
import { reactConditionsResolverPlugin } from "./reactConditionsResolverPlugin.mjs";
import { findWranglerConfig } from "../lib/findWranglerConfig.mjs";
import { pathExists } from "fs-extra";
import { injectVitePreamble } from "./injectVitePreamblePlugin.mjs";
import { vitePreamblePlugin } from "./vitePreamblePlugin.mjs";
import { prismaPlugin } from "./prismaPlugin.mjs";
import { ssrBridgePlugin } from "./ssrBridgePlugin.mjs";
import { hasPkgScript } from "../lib/hasPkgScript.mjs";
import { devServerTimingPlugin } from "./devServerTimingPlugin.mjs";

export type RedwoodPluginOptions = {
  silent?: boolean;
  rootDir?: string;
  mode?: "development" | "production";
  includeCloudflarePlugin?: boolean;
  configPath?: string;
  entry?: {
    client?: string | string[];
    worker?: string;
  };
};

export const redwoodPlugin = async (
  options: RedwoodPluginOptions = {},
): Promise<InlineConfig["plugins"]> => {
  const projectRootDir = process.cwd();

  const mode =
    options.mode ??
    (process.env.NODE_ENV === "development" ? "development" : "production");

  const clientEntryPathnames = (
    Array.isArray(options.entry?.client)
      ? options.entry.client
      : [options.entry?.client ?? "src/client.tsx"]
  ).map((entry) => resolve(projectRootDir, entry));

  const workerEntryPathname = resolve(
    projectRootDir,
    options?.entry?.worker ?? "src/worker.tsx",
  );

  const clientFiles = new Set<string>();
  const serverFiles = new Set<string>();

  const shouldIncludeCloudflarePlugin =
    options.includeCloudflarePlugin ??
    !(await hasOwnCloudflareVitePlugin({ rootProjectDir: projectRootDir }));

  // context(justinvdm, 31 Mar 2025): We assume that if there is no .wrangler directory,
  // then this is fresh install, and we run `npm run dev:init` here.
  if (
    process.env.RWSDK_WORKER_RUN !== "1" &&
    process.env.RWSDK_DEPLOY !== "1" &&
    !(await pathExists(resolve(projectRootDir, ".wrangler"))) &&
    (await hasPkgScript(projectRootDir, "dev:init"))
  ) {
    console.log(
      "🚀 Project has no .wrangler directory yet, assuming fresh install: running `npm run dev:init`...",
    );
    await $({
      // context(justinvdm, 01 Apr 2025): We want to avoid interactive migration y/n prompt, so we ignore stdin
      // as a signal to operate in no-tty mode
      stdio: ["ignore", "inherit", "inherit"],
    })`npm run dev:init`;
  }

  return [
    devServerTimingPlugin(),
    configPlugin({
      mode,
      silent: options.silent ?? false,
      projectRootDir,
      clientEntryPathnames,
      workerEntryPathname,
    }),
    ssrBridgePlugin({
      clientFiles,
      serverFiles,
      projectRootDir,
    }),
    reactConditionsResolverPlugin(),
    tsconfigPaths({ root: projectRootDir }),
    shouldIncludeCloudflarePlugin
      ? cloudflare({
          viteEnvironment: { name: "worker" },
          configPath:
            options.configPath ?? (await findWranglerConfig(projectRootDir)),
        })
      : [],
    miniflareHMRPlugin({
      rootDir: projectRootDir,
      viteEnvironment: { name: "worker" },
      workerEntryPathname,
    }),
    reactPlugin(),
    directivesPlugin({
      projectRootDir,
      clientFiles,
      serverFiles,
    }),
    vitePreamblePlugin(),
    injectVitePreamble({ clientEntryPathnames, mode }),
    useClientLookupPlugin({
      projectRootDir,
      clientFiles,
    }),
    useServerLookupPlugin({
      projectRootDir,
      serverFiles,
    }),
    transformJsxScriptTagsPlugin({
      manifestPath: resolve(
        projectRootDir,
        "dist",
        "client",
        ".vite",
        "manifest.json",
      ),
    }),
    moveStaticAssetsPlugin({ rootDir: projectRootDir }),
    prismaPlugin({ projectRootDir }),
  ];
};
