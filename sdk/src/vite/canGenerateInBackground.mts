import { hasPkgScript } from "../lib/hasPkgScript.mjs";

export const canGenerateInBackground = async (projectRootDir: string) => {
  const hasGenerate = await hasPkgScript(projectRootDir, "generate");
  const hasMigrateDev = await hasPkgScript(projectRootDir, "migrate:dev");
  const hasSeed = await hasPkgScript(projectRootDir, "seed");

  return hasGenerate && !hasMigrateDev && !hasSeed;
};
