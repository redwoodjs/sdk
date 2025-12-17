import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

try {
  console.log("Building SDK for E2E tests...");
  execSync("pnpm build", {
    cwd: path.join(rootDir, "sdk"),
    stdio: "inherit",
  });

  let rawArgs = process.argv.slice(2);

  if (rawArgs[0] === "--") {
    rawArgs = rawArgs.slice(1);
  }

  const vitestArgs = rawArgs.map((arg) => {
    const prefix = "playground" + path.sep;
    if (arg.startsWith(prefix)) {
      return arg.substring(prefix.length);
    }
    return arg;
  });

  let hasErrors = false;

  // Pass 1: Dev tests (sequential to avoid resource contention)
  console.log(
    `Running dev server tests (sequential) with args: ${vitestArgs.join(" ") || "(none)"}`,
  );
  try {
    execSync(`vitest run ${vitestArgs.join(" ")}`, {
      cwd: path.join(rootDir, "playground"),
      stdio: "inherit",
      env: { ...process.env, RWSDK_SKIP_DEPLOY: "1", RWSDK_SEQUENTIAL: "1" },
    });
  } catch (error) {
    console.error("Dev server tests failed.");
    hasErrors = true;
  }

  // Pass 2: Deploy tests (parallel, network-bound)
  console.log(
    `Running deployment tests (parallel) with args: ${vitestArgs.join(" ") || "(none)"}`,
  );
  try {
    execSync(`vitest run ${vitestArgs.join(" ")}`, {
      cwd: path.join(rootDir, "playground"),
      stdio: "inherit",
      env: { ...process.env, RWSDK_SKIP_DEV: "1" },
    });
  } catch (error) {
    console.error("Deployment tests failed.");
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  }
} catch (error) {
  console.error("E2E test script failed.");
  process.exit(1);
}
