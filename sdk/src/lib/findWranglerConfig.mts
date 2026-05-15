import { pathExists } from "fs-extra";
import { resolve } from "path";

export const findWranglerConfig = async (projectRootDir: string) => {
  const configFiles = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"];
  for (const file of configFiles) {
    const fullPath = resolve(projectRootDir, file);
    if (await pathExists(fullPath)) {
      return fullPath;
    }
  }
  throw new Error("No wrangler configuration file found.");
};
