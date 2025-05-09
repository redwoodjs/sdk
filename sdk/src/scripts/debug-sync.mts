import { $ } from "../lib/$.mjs";

export const debugSync = async () => {
  const args = process.argv.slice(2);
  const targetDir = args[0];
  const flags = new Set(args.slice(1));

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  const syncCommand = `echo 🏗️ rebuilding... && pnpm build && rm -rf ${targetDir}/node_modules/rwsdk/{dist,vendor} && cp -r dist ${targetDir}/node_modules/rwsdk/ && cp -r vendor ${targetDir}/node_modules/rwsdk/ && echo ✅ done`;

  // Run initial sync
  await $({ stdio: "inherit", shell: true })`${syncCommand}`;

  // If --dev flag is present, clean vite cache and start dev server
  if (flags.has("--dev")) {
    console.log("🧹 Cleaning Vite cache...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`npm run clean:vite`;

    console.log("🚀 Starting dev server...");
    await $({ stdio: "inherit", shell: true, cwd: targetDir })`npm run dev`;
  }
  // Start watching if --watch flag is present
  else if (flags.has("--watch")) {
    console.log("👀 Watching for changes...");
    $({
      stdio: "inherit",
      shell: true,
    })`npx chokidar-cli './src/**' './vendor/src/**' -c "${syncCommand}"`;
  } else if (flags.has("--build")) {
    console.log("🏗️ Running build in target directory...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`npm run build`;
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  debugSync();
}
