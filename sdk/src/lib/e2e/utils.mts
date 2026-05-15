import { mkdirp } from "fs-extra";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

export async function ensureTmpDir(): Promise<string> {
  let baseTmpDir = os.tmpdir();

  // context(justinvdm, 2 Nov 2025): Normalize the base temp dir on Windows
  // to prevent short/long path mismatches that break Vite's alias resolution.
  if (process.platform === "win32") {
    baseTmpDir = fs.realpathSync.native(baseTmpDir);
  }

  const tmpDir = path.join(baseTmpDir, "rwsdk-e2e");
  await mkdirp(tmpDir);
  return tmpDir;
}