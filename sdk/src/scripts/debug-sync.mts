import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "../lib/$.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DebugSyncOptions {
  targetDir: string;
  sdkDir?: string;
  dev?: boolean;
  watch?: boolean;
  build?: boolean;
}

export const debugSync = async (opts: DebugSyncOptions) => {
  const { targetDir, sdkDir = process.cwd(), dev, watch, build } = opts;

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  const syncCommand = `echo 🏗️ rebuilding... && pnpm build && rm -rf ${targetDir}/node_modules/rwsdk/dist ${targetDir}/node_modules/rwsdk/package.json && echo 📁 syncing sdk from ${sdkDir} to ${targetDir}/node_modules/rwsdk/... && cp -r package.json dist ${targetDir}/node_modules/rwsdk/ && echo ✅ done syncing`;

  // Run initial sync
  await $({ stdio: "inherit", shell: true })`${syncCommand}`;

  if (!process.env.NO_CLEAN_VITE) {
    console.log("🧹 Cleaning Vite cache...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`rm -rf node_modules/.vite`;
  }

  // If dev flag is present, clean vite cache and start dev server
  if (dev) {
    console.log("🚀 Starting dev server...");
    await $({ stdio: "inherit", shell: true, cwd: targetDir })`npm run dev`;
  }
  // Start watching if watch flag is present
  else if (watch) {
    console.log("👀 Watching for changes...");
    $({
      stdio: "inherit",
      shell: true,
    })`npx chokidar-cli './src/**' './package.json' -c "${syncCommand}"`;
  } else if (build) {
    console.log("🏗️ Running build in target directory...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`npm run build`;
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const args = process.argv.slice(2);
  const targetDir = args[0] ?? ".";
  const flags = new Set(args.slice(1));
  debugSync({
    targetDir,
    sdkDir: process.env.SDK_REPO
      ? path.resolve(__dirname, process.env.SDK_REPO, "sdk")
      : path.resolve(__dirname, "..", ".."),
    dev: flags.has("--dev"),
    watch: flags.has("--watch"),
    build: flags.has("--build"),
  });
}
