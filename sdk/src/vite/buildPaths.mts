import { resolve } from "node:path";

export type BuildPaths = Readonly<{
  intermediatesDir: string;
  tempEntryPath: string;
  directiveScanOutDir: string;
  ssrBridgePath: string;
}>;

// context(chrisvdm, 2026-09-11): Intermediate files can contain application
// code, so their paths must be owned by the application rather than by a
// possibly shared RedwoodSDK installation.
export const createBuildPaths = (projectRootDir: string): BuildPaths => {
  const intermediatesDir = resolve(
    projectRootDir,
    "node_modules",
    ".cache",
    "rwsdk",
    "__intermediate_builds",
  );

  return {
    intermediatesDir,
    tempEntryPath: resolve(intermediatesDir, "temp-entry.js"),
    directiveScanOutDir: resolve(intermediatesDir, "directive-scan"),
    ssrBridgePath: resolve(intermediatesDir, "ssr", "ssr_bridge.js"),
  };
};
