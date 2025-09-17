import { readFile } from "fs/promises";
import { resolve } from "path";

let pkg: Record<string, any>;

export const hasPkgScript = async (projectRootDir: string, script: string) => {
  if (!pkg) {
    pkg = JSON.parse(
      await readFile(resolve(projectRootDir, "package.json"), "utf-8"),
    );
  }

  return pkg.scripts?.[script];
};
