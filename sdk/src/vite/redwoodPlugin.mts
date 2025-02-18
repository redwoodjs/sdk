import { dirname, resolve } from "node:path";
import { InlineConfig } from 'vite';

import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import {
  DEV_SERVER_PORT,
  VENDOR_DIST_DIR,
} from "../lib/constants.mjs";
import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "./useServerPlugin.mjs";
import { useClientPlugin } from "./useClientPlugin.mjs";
import { useClientLookupPlugin } from "./useClientLookupPlugin.mjs";
import { miniflarePlugin } from "./miniflarePlugin.mjs";
import { asyncSetupPlugin } from "./asyncSetupPlugin.mjs";
import { copyPrismaWasmPlugin } from "./copyPrismaWasmPlugin.mjs";
import { moveStaticAssetsPlugin } from "./moveStaticAssetsPlugin.mjs";
import { configPlugin } from "./configPlugin.mjs";
import { $ } from '../lib/$.mjs';
import { customReactBuildPlugin } from './customReactBuildPlugin.mjs';
import { injectHmrPreambleJsxPlugin } from "./injectHmrPreambleJsxPlugin.mjs";

export type RedwoodPluginOptions = {
  silent?: boolean;
  port?: number;
  rootDir?: string;
  mode?: 'development' | 'production';
  configPath?: string;
  entry?: {
    client?: string;
    worker?: string;
  };
}

export const redwoodPlugin = async (options: RedwoodPluginOptions = {}): Promise<InlineConfig['plugins']> => {
  const projectRootDir = process.cwd();
  const mode = options.mode ?? (process.env.NODE_ENV === "development" ? "development" : "production");
  const clientEntryPathname = resolve(projectRootDir, options?.entry?.client ?? 'src/client.tsx');
  const workerEntryPathname = resolve(projectRootDir, options?.entry?.worker ?? 'src/worker.tsx');

  const usesPrisma = await $({ reject: false })`pnpm prisma --version`;
  const isUsingPrisma = usesPrisma.exitCode === 0;

  return [
    configPlugin({
      mode,
      silent: options.silent ?? false,
      projectRootDir,
      clientEntryPathname,
      workerEntryPathname,
      port: options.port ?? DEV_SERVER_PORT,
      isUsingPrisma,
    }),
    customReactBuildPlugin(),
    tsconfigPaths({ root: projectRootDir }),
    miniflarePlugin({
      rootDir: projectRootDir,
      viteEnvironment: { name: "worker" },
      workerEntryPathname,
      configPath: options.configPath ?? resolve(projectRootDir, "wrangler.toml"),
    }),
    reactPlugin(),
    useServerPlugin(),
    useClientPlugin(),
    asyncSetupPlugin({
      async setup({ command }) {
        if (command !== 'build') {
          console.log('Generating wrangler types...')
          await $`pnpm wrangler types`;
        }
      }
    }),
    injectHmrPreambleJsxPlugin(),
    useClientLookupPlugin({
      rootDir: projectRootDir,
      containingPath: "./src/app",
    }),
    transformJsxScriptTagsPlugin({
      manifestPath: resolve(projectRootDir, "dist", "client", ".vite", "manifest.json"),
    }),
    ...(isUsingPrisma ? [copyPrismaWasmPlugin({ rootDir: projectRootDir })] : []),
    moveStaticAssetsPlugin({ rootDir: projectRootDir }),
  ];
}
