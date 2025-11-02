import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
