import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "../lib/$.mjs";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DebugSyncOptions {
  targetDir: string;
  sdkDir?: string;
  dev?: boolean;
  watch?: boolean;
  build?: boolean;
}

const getPackageManagerInfo = (targetDir: string) => {
  if (existsSync(path.join(targetDir, "yarn.lock"))) {
    return { name: "yarn", lockFile: "yarn.lock", command: "add" };
  }
  if (existsSync(path.join(targetDir, "pnpm-lock.yaml"))) {
    return { name: "pnpm", lockFile: "pnpm-lock.yaml", command: "add" };
  }
  return { name: "npm", lockFile: "package-lock.json", command: "install" };
};

const performSync = async (sdkDir: string, targetDir: string) => {
  console.log("🏗️  rebuilding sdk...");
  await $({ cwd: sdkDir, stdio: "inherit", shell: true })`pnpm build`;

  console.log("📦 packing sdk...");
  const packResult = await $({ cwd: sdkDir, shell: true })`npm pack`;
  const tarballName = packResult.stdout?.trim() ?? "";
  const tarballPath = path.resolve(sdkDir, tarballName);

  console.log(` installing ${tarballName} in ${targetDir}...`);

  const pm = getPackageManagerInfo(targetDir);
  const packageJsonPath = path.join(targetDir, "package.json");
  const lockfilePath = path.join(targetDir, pm.lockFile);

  const originalPackageJson = await fs
    .readFile(packageJsonPath, "utf-8")
    .catch(() => null);
  const originalLockfile = await fs
    .readFile(lockfilePath, "utf-8")
    .catch(() => null);

  try {
    let installCommand = `${pm.name} ${pm.command} ${tarballPath}`;
    if (pm.name === "yarn") {
      installCommand = `yarn add file:${tarballPath}`;
    }
    await $({
      cwd: targetDir,
      stdio: "inherit",
      shell: true,
    })`${installCommand}`;
  } finally {
    if (originalPackageJson) {
      console.log("Restoring package.json...");
      await fs.writeFile(packageJsonPath, originalPackageJson);
    }
    if (originalLockfile) {
      console.log(`Restoring ${pm.lockFile}...`);
      await fs.writeFile(lockfilePath, originalLockfile);
    }
    await fs.unlink(tarballPath).catch(() => {
      // ignore if deletion fails
    });
  }
  console.log("✅ done syncing");
};

export const debugSync = async (opts: DebugSyncOptions) => {
  const { targetDir, sdkDir = process.cwd(), dev, watch, build } = opts;

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  const thisScriptPath = fileURLToPath(import.meta.url);
  const syncCommand = `tsx ${thisScriptPath} --_sync ${sdkDir} ${targetDir}`;

  // Run initial sync
  await performSync(sdkDir, targetDir);

  if (!process.env.NO_CLEAN_VITE) {
    console.log("🧹 Cleaning Vite cache...");
    await $({
      stdio: "inherit",
      shell: true,
      cwd: targetDir,
    })`rm -rf ${targetDir}/node_modules/.vite*`;
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
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));

  if (flags.has("--_sync")) {
    const [sdkDir, targetDir] = positionalArgs;
    await performSync(sdkDir, targetDir);
  } else {
    const targetDir = positionalArgs[0] ?? process.cwd();
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
}
