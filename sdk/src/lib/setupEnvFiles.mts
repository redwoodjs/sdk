import { pathExists } from "fs-extra";
import { copyFile, symlink } from "node:fs/promises";
import { resolve } from "node:path";

export type EnvSetupOptions = {
  rootDir: string;
};

export async function setupEnvFiles({
  rootDir,
}: EnvSetupOptions): Promise<void> {
  const envPath = resolve(rootDir, ".env");
  const devVarsPath = resolve(rootDir, ".dev.vars");
  const envExamplePath = resolve(rootDir, ".env.example");

  const envExists = await pathExists(envPath);
  const devVarsExists = await pathExists(devVarsPath);
  const envExampleExists = await pathExists(envExamplePath);

  // If .env.example exists but .env doesn't, copy from example to .env
  if (!envExists && !devVarsExists && envExampleExists) {
    try {
      await copyFile(envExamplePath, envPath);
      console.log("Created .env file from .env.example");
    } catch (error) {
      console.warn("Failed to copy .env.example to .env:", error);
    }
  }

  // Create symlink from .env to .dev.vars if needed
  if ((await pathExists(envPath)) && !devVarsExists) {
    try {
      await symlink(envPath, devVarsPath);
      console.log("Created symlink from .env to .dev.vars");
    } catch (error) {
      console.warn("Failed to create symlink from .env to .dev.vars:", error);
    }
  }
}
