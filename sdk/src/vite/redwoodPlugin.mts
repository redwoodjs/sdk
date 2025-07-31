import { resolve } from "node:path";
import { InlineConfig } from "vite";
import { unstable_readConfig } from "wrangler";
import { cloudflare } from "@cloudflare/vite-plugin";

import { devServerConstantPlugin } from "./devServerConstant.mjs";
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
import { manifestPlugin } from "./manifestPlugin.mjs";
import { cssModuleProxyPlugin } from "./cssModuleProxyPlugin.mjs";

export type RedwoodPluginOptions = {
  silent?: boolean;
  rootDir?: string;
  includeCloudflarePlugin?: boolean;
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

export const redwoodPlugin = async (
  options: RedwoodPluginOptions = {},
): Promise<InlineConfig["plugins"]> => {
  const projectRootDir = process.cwd();

  const workerConfigPath =
    options.configPath ?? (await findWranglerConfig(projectRootDir));

  const workerEntryPathname = await determineWorkerEntryPathname(
    projectRootDir,
    workerConfigPath,
    options,
  );

  const clientEntryPathnames = (
    Array.isArray(options.entry?.client)
      ? options.entry.client
      : [options.entry?.client ?? "src/client.tsx"]
  ).map((entry) => resolve(projectRootDir, entry));

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
    devServerConstantPlugin(),
    configPlugin({
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
    reactPlugin(),
    cssModuleProxyPlugin({ projectRootDir }),
    directivesPlugin({
      projectRootDir,
      clientFiles,
      serverFiles,
    }),
    vitePreamblePlugin(),
    injectVitePreamble({ clientEntryPathnames }),
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
    manifestPlugin({
      clientManifestPath: resolve(
        projectRootDir,
        "dist",
        "client",
        ".vite",
        "manifest.json",
      ),
      workerManifestPath: resolve(
        projectRootDir,
        "dist",
        "worker",
        ".vite",
        "manifest.json",
      ),
      workerEntryPathname,
    }),
    moveStaticAssetsPlugin({ rootDir: projectRootDir }),
    prismaPlugin({ projectRootDir }),
  ];
};
