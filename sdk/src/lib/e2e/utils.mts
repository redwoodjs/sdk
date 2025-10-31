import os from "os";
import path from "path";
import { mkdirp } from "fs-extra";

export const ensureTmpDir = async () => {
  const tmpDir = path.join(os.tmpdir(), "rwsdk-e2e");
  await mkdirp(tmpDir);
  return tmpDir;
};