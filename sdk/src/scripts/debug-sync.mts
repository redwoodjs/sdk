import { $ } from "../lib/$.mjs";

export interface DebugSyncOptions {
  targetDir: string;
  dev?: boolean;
  watch?: boolean;
  build?: boolean;
}

export const debugSync = async (opts: DebugSyncOptions) => {
  const { targetDir, dev, watch, build } = opts;

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  const syncCommand = `echo 🏗️ rebuilding... && pnpm build && rm -rf ${targetDir}/node_modules/rwsdk/{dist,vendor} && cp -r dist ${targetDir}/node_modules/rwsdk/ && cp -r vendor ${targetDir}/node_modules/rwsdk/ && echo ✅ done`;

  // Run initial sync
  await $({ stdio: "inherit", shell: true })`${syncCommand}`;

  console.log("🧹 Cleaning Vite cache...");
  await $({
    stdio: "inherit",
    shell: true,
    cwd: targetDir,
  })`npm run clean:vite`;

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
    })`npx chokidar-cli './src/**' './vendor/src/**' -c "${syncCommand}"`;
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
  const targetDir = args[0];
  const flags = new Set(args.slice(1));
  debugSync({
    targetDir,
    dev: flags.has("--dev"),
    watch: flags.has("--watch"),
    build: flags.has("--build"),
  });
}
