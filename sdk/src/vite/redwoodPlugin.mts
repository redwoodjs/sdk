import { resolve } from "node:path";
import { InlineConfig } from "vite";

import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";
import { rscDirectivesPlugin } from "./rscDirectivesPlugin.mjs";
import { useClientLookupPlugin } from "./useClientLookupPlugin.mjs";
import { miniflarePlugin } from "./miniflarePlugin.mjs";
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

export type RedwoodPluginOptions = {
  silent?: boolean;
  rootDir?: string;
  mode?: "development" | "production";
  configPath?: string;
  entry?: {
    client?: string;
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
  const clientEntryPathname = resolve(
    projectRootDir,
    options?.entry?.client ?? "src/client.tsx",
  );
  const workerEntryPathname = resolve(
    projectRootDir,
    options?.entry?.worker ?? "src/worker.tsx",
  );

  const clientFiles = new Set<string>();

  // context(justinvdm, 31 Mar 2025): We assume that if there is no .wrangler directory,
  // then this is fresh install, and we run `npm run dev:init` here.
  if (
    process.env.RWSDK_WORKER_RUN !== "1" &&
    process.env.RWSDK_DEPLOY !== "1" &&
    !(await pathExists(resolve(process.cwd(), ".wrangler")))
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
    configPlugin({
      mode,
      silent: options.silent ?? false,
      projectRootDir,
      clientEntryPathname,
      workerEntryPathname,
    }),
    ssrBridgePlugin({ projectRootDir }),
    reactConditionsResolverPlugin(),
    tsconfigPaths({ root: projectRootDir }),
    miniflarePlugin({
      rootDir: projectRootDir,
      viteEnvironment: { name: "worker" },
      workerEntryPathname,
      configPath:
        options.configPath ?? (await findWranglerConfig(projectRootDir)),
    }),
    reactPlugin(),
    rscDirectivesPlugin({
      projectRootDir,
      clientFiles,
    }),
    vitePreamblePlugin(),
    injectVitePreamble({ clientEntryPathname, mode }),
    useClientLookupPlugin({
      projectRootDir,
      clientFiles,
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
