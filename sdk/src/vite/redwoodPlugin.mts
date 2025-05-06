import { resolve } from "node:path";
import { InlineConfig } from "vite";

import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "./useServerPlugin.mjs";
import { useClientPlugin } from "./useClientPlugin.mjs";
import { useClientLookupPlugin } from "./useClientLookupPlugin.mjs";
import { miniflarePlugin } from "./miniflarePlugin.mjs";
import { copyPrismaWasmPlugin } from "./copyPrismaWasmPlugin.mjs";
import { moveStaticAssetsPlugin } from "./moveStaticAssetsPlugin.mjs";
import { configPlugin } from "./configPlugin.mjs";
import { $ } from "../lib/$.mjs";
import { reactConditionsResolverPlugin } from "./reactConditionsResolverPlugin.mjs";
import { invalidateCacheIfPrismaClientChanged } from "./invalidateCacheIfPrismaClientChanged.mjs";
import { findWranglerConfig } from "../lib/findWranglerConfig.mjs";
import { pathExists } from "fs-extra";
import { injectVitePreamble } from "./injectVitePreamblePlugin.mjs";
import { vitePreamblePlugin } from "./vitePreamblePlugin.mjs";
import { checkIsUsingPrisma } from "./checkIsUsingPrisma.mjs";

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

  const isUsingPrisma = checkIsUsingPrisma({ projectRootDir });

  // context(justinvdm, 10 Mar 2025): We need to use vite optimizeDeps for all deps to work with @cloudflare/vite-plugin.
  // Thing is, @prisma/client has generated code. So users end up with a stale @prisma/client
  // when they change their prisma schema and regenerate the client, until clearing out node_modules/.vite
  // We can't exclude @prisma/client from optimizeDeps since we need it there for @cloudflare/vite-plugin to work.
  // But we can manually invalidate the cache if the prisma schema changes.
  await invalidateCacheIfPrismaClientChanged({
    projectRootDir,
  });

  return [
    configPlugin({
      mode,
      silent: options.silent ?? false,
      projectRootDir,
      clientEntryPathname,
      workerEntryPathname,
      isUsingPrisma,
    }),
    reactConditionsResolverPlugin({ projectRootDir, mode }),
    tsconfigPaths({ root: projectRootDir }),
    miniflarePlugin({
      rootDir: projectRootDir,
      viteEnvironment: { name: "worker" },
      workerEntryPathname,
      configPath:
        options.configPath ?? (await findWranglerConfig(projectRootDir)),
    }),
    reactPlugin(),
    useServerPlugin(),
    useClientPlugin(),
    vitePreamblePlugin(),
    injectVitePreamble({ clientEntryPathname, mode }),
    useClientLookupPlugin({
      rootDir: projectRootDir,
      containingPath: "./src/app",
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
    ...(isUsingPrisma
      ? [copyPrismaWasmPlugin({ rootDir: projectRootDir })]
      : []),
    moveStaticAssetsPlugin({ rootDir: projectRootDir }),
  ];
};
