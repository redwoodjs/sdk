import { readFile as fsReadFile } from "fs/promises";
import { resolve } from "path";

export let _pkgCache: Record<string, any> | undefined;

export const hasPkgScript = async (
  projectRootDir: string,
  script: string,
  readFile = fsReadFile,
) => {
  if (!_pkgCache) {
    _pkgCache = JSON.parse(
      (await readFile(resolve(projectRootDir, "package.json"))) as string,
    );
  }

  return _pkgCache.scripts?.[script];
};

export const _resetPkgCache = () => {
  _pkgCache = undefined;
};
