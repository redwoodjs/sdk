import { glob } from "glob";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

export async function resolveForcedPaths({
  patterns,
  projectRootDir,
}: {
  patterns: string[];
  projectRootDir: string;
}) {
  return (
    await glob(patterns, {
      cwd: projectRootDir,
      absolute: true,
      realpath: true,
    })
  ).map((filepath: string) => normalizeModulePath(filepath, projectRootDir));
}
