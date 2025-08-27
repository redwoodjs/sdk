import { resolve } from "node:path";
import { InlineConfig } from "vite";
import { unstable_readConfig } from "wrangler";
import { cloudflare } from "@cloudflare/vite-plugin";

import { devServerConstantPlugin } from "./devServerConstant.mjs";
import { hasOwnCloudflareVitePlugin } from "./hasOwnCloudflareVitePlugin.mjs";
import { hasOwnReactVitePlugin } from "./hasOwnReactVitePlugin.mjs";

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
import { manifestPlugin } from "./manifestPlugin.mjs";

export type RedwoodPluginOptions = {
  silent?: boolean;
  rootDir?: string;
  includeCloudflarePlugin?: boolean;
  includeReactPlugin?: boolean;
  configPath?: string;
  entry?: {
    client?: string | string[];
    worker?: string;
  };
};

const determineWorkerEntryPathname = async (
  projectRootDir: string,
  workerConfigPath: string,
  options: RedwoodPluginOptions,
) => {
  if (options.entry?.worker) {
    return resolve(projectRootDir, options.entry.worker);
  }

  const workerConfig = unstable_readConfig({ config: workerConfigPath });

  return resolve(projectRootDir, workerConfig.main ?? "src/worker.tsx");
};

const clientFiles = new Set<string>();
const serverFiles = new Set<string>();
const clientEntryPoints = new Set<string>();

export const redwoodPlugin = async (
  options: RedwoodPluginOptions = {},
): Promise<InlineConfig["plugins"]> => {
  const projectRootDir = process.cwd();

  const workerConfigPath =
    options.configPath ??
    (process.env.RWSDK_WRANGLER_CONFIG
      ? resolve(projectRootDir, process.env.RWSDK_WRANGLER_CONFIG)
      : await findWranglerConfig(projectRootDir));

  const workerEntryPathname = await determineWorkerEntryPathname(
    projectRootDir,
    workerConfigPath,
    options,
  );

  const shouldIncludeCloudflarePlugin =
    options.includeCloudflarePlugin ??
    !(await hasOwnCloudflareVitePlugin({ rootProjectDir: projectRootDir }));

  const shouldIncludeReactPlugin =
    options.includeReactPlugin ??
    !(await hasOwnReactVitePlugin({ rootProjectDir: projectRootDir }));

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
    devServerConstantPlugin(),
    configPlugin({
      silent: options.silent ?? false,
      projectRootDir,
      workerEntryPathname,
      clientFiles,
      clientEntryPoints,
    }),
    ssrBridgePlugin({
      clientFiles,
      serverFiles,
      projectRootDir,
    }),
    reactConditionsResolverPlugin({ projectRootDir }),
    tsconfigPaths({ root: projectRootDir }),
    shouldIncludeCloudflarePlugin
      ? cloudflare({
          viteEnvironment: { name: "worker" },
          configPath: workerConfigPath,
        })
      : [],
    miniflareHMRPlugin({
      clientFiles,
      serverFiles,
      rootDir: projectRootDir,
      viteEnvironment: { name: "worker" },
      workerEntryPathname,
    }),
    shouldIncludeReactPlugin ? reactPlugin() : [],
    directivesPlugin({
      projectRootDir,
      clientFiles,
      serverFiles,
    }),
    vitePreamblePlugin(),
    injectVitePreamble({
      clientEntryPathnames: (Array.isArray(options.entry?.client)
        ? options.entry.client
        : [options.entry?.client ?? "src/client.tsx"]
      ).map((entry) => resolve(projectRootDir, entry)),
    }),
    useClientLookupPlugin({
      projectRootDir,
      clientFiles,
    }),
    useServerLookupPlugin({
      projectRootDir,
      serverFiles,
    }),
    transformJsxScriptTagsPlugin({
      clientEntryPoints,
    }),
    manifestPlugin({
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
