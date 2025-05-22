import { Plugin } from "vite";
import { resolve } from "node:path";
import { invalidateCacheIfPrismaClientChanged } from "./invalidateCacheIfPrismaClientChanged.mjs";
import { checkPrismaStatus } from "./checkIsUsingPrisma.mjs";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

export const prismaPlugin = async ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Promise<Plugin | undefined> => {
  if (!checkPrismaStatus({ projectRootDir }).isUsingPrisma) {
    return;
  }

  // context(justinvdm, 10 Mar 2025): We need to use vite optimizeDeps for all deps to work with @cloudflare/vite-plugin.
  // Thing is, @prisma/client has generated code. So users end up with a stale @prisma/client
  // when they change their prisma schema and regenerate the client, until clearing out node_modules/.vite
  // We can't exclude @prisma/client from optimizeDeps since we need it there for @cloudflare/vite-plugin to work.
  // But we can manually invalidate the cache if the prisma schema changes.
  await invalidateCacheIfPrismaClientChanged({
    projectRootDir,
  });

  return {
    name: "rwsdk:prisma-client",
    configEnvironment(name, config, env) {
      if (name !== "worker") {
        return;
      }

      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];

      ensureAliasArray(config).push({
        find: /^\.prisma\/client\/default/,
        replacement: resolve(
          projectRootDir,
          "node_modules/.prisma/client/wasm.js",
        ),
      });
    },
  };
};
