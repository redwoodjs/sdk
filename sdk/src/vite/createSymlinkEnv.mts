import { resolve } from "node:path";
import { symlink } from "node:fs/promises";
import { pathExists } from "fs-extra";

export type SymlinkEnvOptions = {
  rootDir: string;
};

export async function createSymlinkEnv({
  rootDir,
}: SymlinkEnvOptions): Promise<void> {
  const envPath = resolve(rootDir, ".env");
  const devVarsPath = resolve(rootDir, ".dev.vars");

  const envExists = await pathExists(envPath);
  const devVarsExists = await pathExists(devVarsPath);

  if (envExists && !devVarsExists) {
    try {
      await symlink(envPath, devVarsPath);
      console.log("Created symlink from .env to .dev.vars");
    } catch (error) {
      console.warn("Failed to create symlink from .env to .dev.vars:", error);
    }
  }
}
