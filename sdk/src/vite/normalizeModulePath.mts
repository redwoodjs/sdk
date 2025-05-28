import path from "node:path";

export const normalizeModulePath = (
  projectRootDir: string,
  modulePath: string,
) => "/" + path.relative(projectRootDir, modulePath);
