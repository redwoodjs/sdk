import { resolve } from "node:path";
import type { Plugin } from "vite";
import { symlink, unlink } from "node:fs/promises";
import { pathExists } from "fs-extra";

export type SymlinkEnvPluginOptions = {
  rootDir: string;
};

export async function symlinkEnvPlugin({
  rootDir,
}: SymlinkEnvPluginOptions): Promise<Plugin> {
  let createdSymlink = false;

  const envPath = resolve(rootDir, ".env");
  const devVarsPath = resolve(rootDir, ".dev.vars");

  const envExists = await pathExists(envPath);
  const devVarsExists = await pathExists(devVarsPath);

  if (envExists && !devVarsExists) {
    try {
      await symlink(envPath, devVarsPath);
      createdSymlink = true;
      console.log("Created symlink from .env to .dev.vars");
    } catch (error) {
      console.warn("Failed to create symlink from .env to .dev.vars:", error);
    }
  }

  const cleanup = async () => {
    if (createdSymlink) {
      try {
        if (await pathExists(devVarsPath)) {
          await unlink(devVarsPath);
          console.log("Removed .dev.vars symlink");
        }
      } catch (error) {
        console.warn("Failed to remove .dev.vars symlink:", error);
      }
      createdSymlink = false;
    }
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  return {
    name: "redwood:symlink-env",
    configureServer(server) {
      server.httpServer?.on("close", cleanup);
    },
    async closeBundle() {
      await cleanup();
    },
  };
}
