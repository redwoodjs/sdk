import { glob } from "glob";

export async function resolveForcedPaths({
  patterns,
  projectRootDir,
}: {
  patterns: string[];
  projectRootDir: string;
}) {
  return await glob(patterns, {
    cwd: projectRootDir,
    absolute: true,
  });
}
