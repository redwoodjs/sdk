import path from "node:path";

export const normalizeModulePath = (
  projectRootDir: string,
  modulePath: string,
) => {
  const isNodeModule = modulePath.includes("node_modules");

  // context(justinvdm, 2025-07-22): For monorepos, node_modules might be above projectRootDir
  if (isNodeModule) {
    return modulePath;
  }

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
