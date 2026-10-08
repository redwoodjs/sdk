import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sdkDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(sdkDir, "..");
const artifactsDir = process.env.RWSDK_E2E_ARTIFACT_DIR;
if (artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
}

function run(command, args, cwd, shell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell,
      stdio: ["inherit", "pipe", "pipe"],
    });
    for (const [source, destination] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      source.on("data", (data) => {
        destination.write(data);
        if (artifactsDir) {
          appendFileSync(path.join(artifactsDir, "runner.log"), data);
        }
      });
    }
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

try {
  console.log("Building SDK for E2E tests...");
  const buildCode = await run("pnpm build", [], sdkDir, true);
  if (buildCode !== 0) {
    process.exitCode = buildCode;
  } else {
    const rawArgs = process.argv.slice(2);
    if (rawArgs[0] === "--") {
      rawArgs.shift();
    }
    const args = rawArgs.map((arg) => {
      const prefix = "playground" + path.sep;
      return arg.startsWith(prefix) ? arg.substring(prefix.length) : arg;
    });
    console.log(
      `Running vitest in playground with args: ${args.join(" ") || "(none)"}`,
    );
    const vitest = path.join(
      path.dirname(require.resolve("vitest/package.json")),
      "vitest.mjs",
    );
    process.exitCode = await run(
      process.execPath,
      [vitest, "run", ...args],
      path.join(rootDir, "playground"),
    );
  }
} catch (error) {
  console.error("E2E test script failed:", error);
  process.exitCode = 1;
}
