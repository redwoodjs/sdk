import { mkdirp } from "fs-extra";
import path from "path";
import { ROOT_DIR } from "../constants.mjs";


export const ensureTmpDir = async () => {
  const tmpDir = path.join(ROOT_DIR, ".tmp");
  await mkdirp(tmpDir);
  return tmpDir;
};