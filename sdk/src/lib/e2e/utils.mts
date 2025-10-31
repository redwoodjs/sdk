import { mkdirp } from "fs-extra";


export const ensureTmpDir = async () => {
  const tmpDir = path.join(ROOT_DIR, ".tmp");
  await mkdirp(tmpDir);
  return tmpDir;
};