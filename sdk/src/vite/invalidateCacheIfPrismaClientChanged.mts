import { pathExists, remove } from "fs-extra";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export const invalidateCacheIfPrismaClientChanged = async ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  const viteDepsCachePath = resolve(
    projectRootDir,
    "node_modules",
    ".vite",
    `deps_worker`,
    `@prisma_client.js`,
  );

  // Get mtimes for comparison
  try {
    const schemaPath = resolve(projectRootDir, "prisma", "schema.prisma");

    if (!(await pathExists(schemaPath))) {
      return;
    }

    const [schemaStat, cacheStat] = await Promise.all([
      stat(schemaPath).catch(() => null),
      stat(viteDepsCachePath).catch(() => null),
    ]);

    // If schema exists and either cache doesn't exist or schema is newer
    if (schemaStat && (!cacheStat || schemaStat.mtime > cacheStat.mtime)) {
      // Clear the entire .vite cache directory
      await remove(resolve(projectRootDir, "node_modules", ".vite"));
      return;
    }
  } catch (error) {
    // If there's any error reading files, fall back to removing the entire .vite cache dir regardless
    await remove(resolve(projectRootDir, "node_modules", ".vite"));
  }
};
