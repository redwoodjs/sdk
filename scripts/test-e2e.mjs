import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

if (process.platform === "win32") {
  console.log("--- Running Windows Path Discrepancy Check ---");
  const tmpDir = os.tmpdir();
  const realTmpDir = fs.realpathSync(tmpDir);
  const nativeRealTmpDir = fs.realpathSync.native(tmpDir);

  console.log(`Original os.tmpdir():             ${tmpDir}`);
  console.log(`fs.realpathSync(tmpDir):        ${realTmpDir}`);
  console.log(`fs.realpathSync.native(tmpDir): ${nativeRealTmpDir}`);

  if (tmpDir !== nativeRealTmpDir) {
    console.log(
      "!!! Path discrepancy DETECTED with NATIVE method. This is the likely cause.",
    );
  } else if (tmpDir !== realTmpDir) {
    console.log(
      "!!! Path discrepancy DETECTED with standard method. This is the likely cause.",
    );
  } else {
    console.log("... No path discrepancy detected.");
  }
  console.log("----------------------------------------------");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

try {
  console.log("Building SDK for E2E tests...");
  execSync("pnpm build", {
    cwd: path.join(rootDir, "sdk"),
    stdio: "inherit",
  });

  const rawArgs = process.argv.slice(2);
  const vitestArgs = rawArgs.map((arg) => {
    const prefix = "playground" + path.sep;
    if (arg.startsWith(prefix)) {
      return arg.substring(prefix.length);
    }
    return arg;
  });

  console.log(
    `Running vitest in playground with args: ${vitestArgs.join(" ") || "(none)"}`,
  );
  execSync(`vitest run ${vitestArgs.join(" ")}`, {
    cwd: path.join(rootDir, "playground"),
    stdio: "inherit",
  });
} catch (error) {
  console.error("E2E test script failed.");
  process.exit(1);
}
