import { $ } from "../lib/$.mjs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";
export interface DebugSyncOptions {
  targetDir: string;
  dev?: boolean;
  watch?: boolean;
  build?: boolean;
}

const __dirname = fileURLToPath(import.meta.url);

export const debugSync = async (opts: DebugSyncOptions) => {
  const { targetDir, dev, watch, build } = opts;

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  // Detect if we are in the sdk monorepo by checking ../../../../package.json
  let runCmd = "npm";
  try {
    const monorepoPkgPath = resolve(__dirname, "../../../../package.json");
    const pkgRaw = await readFile(monorepoPkgPath, "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (pkg.name === "rw-sdk-monorepo") {
      runCmd = "pnpm";
    }
  } catch (e) {
    // ignore, fallback to npm
  }

  const syncCommand = `echo 🏗️ rebuilding... && pnpm build && rm -rf ${targetDir}/node_modules/rwsdk/dist && echo 📁 syncing sdk from ${process.cwd()} to ${targetDir}/node_modules/rwsdk/... && cp -r dist ${targetDir}/node_modules/rwsdk/ && echo ✅ done syncing`;

  // Run initial sync
  await $({ stdio: "inherit", shell: true })`${syncCommand}`;

  console.log("🧹 Cleaning Vite cache...");

  await $({
    stdio: "inherit",
    shell: true,
    cwd: targetDir,
  })`${runCmd} run clean:vite`;

  // If dev flag is present, clean vite cache and start dev server
  if (dev) {
    console.log("🚀 Starting dev server...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`${runCmd} run dev -- --clearScreen=false`;
  }
  // Start watching if watch flag is present
  else if (watch) {
    console.log("👀 Watching for changes...");
    $({
      stdio: "inherit",
      shell: true,
    })`npx chokidar-cli './src/**' -c "${syncCommand}"`;
  } else if (build) {
    console.log("🏗️ Running build in target directory...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`${runCmd} run build`;
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const args = process.argv.slice(2);
  const targetDir = args[0];
  const flags = new Set(args.slice(1));
  debugSync({
    targetDir,
    dev: flags.has("--dev"),
    watch: flags.has("--watch"),
    build: flags.has("--build"),
  });
}
