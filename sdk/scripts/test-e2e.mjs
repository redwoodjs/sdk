import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(sdkDir, "..");

try {
  console.log("Building SDK for E2E tests...");
  execSync("pnpm build", {
    cwd: sdkDir,
    stdio: "inherit",
  });

  let rawArgs = process.argv.slice(2);

  if (rawArgs[0] === "--") {
    rawArgs = rawArgs.slice(1);
  }

  const vitestArgs = rawArgs.map((arg) => {
    // Check if the arg is "playground/foo" or just "foo"
    // We want to pass paths relative to the playground root
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
