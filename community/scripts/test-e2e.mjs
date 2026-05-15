import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(pkgDir, "..");

try {
  console.log("Building Core SDK for E2E tests...");
  execSync("pnpm build", {
    cwd: path.join(rootDir, "sdk"),
    stdio: "inherit",
  });

  console.log("Building Community Package for E2E tests...");
  execSync("pnpm build", {
    cwd: pkgDir,
    stdio: "inherit",
  });

  let rawArgs = process.argv.slice(2);

  if (rawArgs[0] === "--") {
    rawArgs = rawArgs.slice(1);
  }

  const vitestArgs = rawArgs.map((arg) => {
    // Map args if they include "community/playground/" prefix to be relative
    const prefix = "community/playground" + path.sep;
    if (arg.startsWith(prefix)) {
      return arg.substring(prefix.length);
    }
    // Also handle just "playground/" prefix if user passes that
     const pgPrefix = "playground" + path.sep;
    if (arg.startsWith(pgPrefix)) {
      return arg.substring(pgPrefix.length);
    }
    return arg;
  });

  console.log(
    `Running vitest in community/playground with args: ${vitestArgs.join(" ") || "(none)"}`,
  );
  
  execSync(`vitest run ${vitestArgs.join(" ")}`, {
    cwd: path.join(pkgDir, "playground"),
    stdio: "inherit",
  });
} catch (error) {
  console.error("Community E2E test script failed.");
  process.exit(1);
}
