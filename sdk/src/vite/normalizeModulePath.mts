import path from "node:path";

export const normalizeModulePath = (
  projectRootDir: string,
  modulePath: string,
) => {
  // /Users/path/to/project/src/foo/bar.ts -> /src/foo/bar.ts
  if (modulePath.startsWith(projectRootDir)) {
    return "/" + path.relative(projectRootDir, modulePath);
  }

  // /src/foo/bar.ts -> /src/foo/bar.ts
  if (modulePath.startsWith("/")) {
    return modulePath;
  }

  // src/foo/bar.ts -> /src/foo/bar.ts
  return "/" + modulePath;
};
