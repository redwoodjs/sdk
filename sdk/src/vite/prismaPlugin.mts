import { resolve } from "node:path";
import { Plugin } from "vite";
import { checkPrismaStatus } from "./checkIsUsingPrisma.mjs";
import { ensureAliasArray } from "./ensureAliasArray.mjs";
import { invalidateCacheIfPrismaClientChanged } from "./invalidateCacheIfPrismaClientChanged.mjs";

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
    name: "rwsdk:prisma",
    configEnvironment(name, config) {
      if (name !== "worker" || !process.env.VITE_IS_DEV_SERVER) {
        return;
      }

      const wasmPath = resolve(
        projectRootDir,
        "node_modules/.prisma/client/wasm.js",
      );

      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];

      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "rwsdk:prisma",
        setup(build: any) {
          build.onResolve({ filter: /^.prisma\/client\/default/ }, async () => {
            return {
              path: wasmPath,
            };
          });
        },
      });

      ensureAliasArray(config).push({
        find: /^\.prisma\/client\/default/,
        replacement: wasmPath,
      });
    },
  };
};
