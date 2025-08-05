import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "execa";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import chokidar from "chokidar";
import { lock } from "proper-lockfile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DebugSyncOptions {
  targetDir: string;
  sdkDir?: string;
  watch?: string | boolean;
}

const getPackageManagerInfo = (targetDir: string) => {
  const pnpmResult = {
    name: "pnpm",
    lockFile: "pnpm-lock.yaml",
    command: "add",
  };
  if (existsSync(path.join(targetDir, "yarn.lock"))) {
    return { name: "yarn", lockFile: "yarn.lock", command: "add" };
  }
  if (
    existsSync(path.join(targetDir, "pnpm-lock.yaml")) ||
    existsSync(path.join(targetDir, "node_modules", ".pnpm"))
  ) {
    return pnpmResult;
  }
  if (existsSync(path.join(targetDir, "package-lock.json"))) {
    return { name: "npm", lockFile: "package-lock.json", command: "install" };
  }
  return pnpmResult;
};

/**
 * @summary Workaround for pnpm's local tarball dependency resolution.
 *
 * @description
 * When installing a new version of the SDK from a local tarball (e.g., during
 * development with `rwsync`), pnpm creates a new, uniquely-named directory in
 * the `.pnpm` store (e.g., `rwsdk@file+...`).
 *
 * A challenge arises when other packages list `rwsdk` as a peer dependency.
 * pnpm may not consistently update the symlinks for these peer dependencies
 * to point to the newest `rwsdk` instance. This can result in a state where
 * multiple versions of `rwsdk` coexist in `node_modules`, with some parts of
 * the application using a stale version.
 *
 * This function addresses the issue by:
 * 1. Identifying the most recently installed `rwsdk` instance in the `.pnpm`
 *    store after a `pnpm install` run.
 * 2. Forcefully updating the top-level `node_modules/rwsdk` symlink to point
 *    to this new instance.
 * 3. Traversing all other `rwsdk`-related directories in the `.pnpm` store
 *    and updating their internal `rwsdk` symlinks to also point to the correct
 *    new instance.
 *
 * I am sorry for this ugly hack, I am sure there is a better way, and that it is me
 * doing something wrong. The aim is not to go down this rabbit hole right now
 * -- @justinvdm
 */
const hackyPnpmSymlinkFix = async (targetDir: string) => {
  console.log("💣 Performing pnpm symlink fix...");
  const pnpmDir = path.join(targetDir, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) {
    console.log("   🤔 No .pnpm directory found.");
    return;
  }

  try {
    const entries = await fs.readdir(pnpmDir);
    // Find ALL rwsdk directories, not just file-based ones, to handle
    // all kinds of stale peer dependencies.
    const rwsdkDirs = entries.filter((e) => e.startsWith("rwsdk@"));
    console.log("   Found rwsdk directories:", rwsdkDirs);

    if (rwsdkDirs.length === 0) {
      console.log("   🤔 No rwsdk directories found to hack.");
      return;
    }

    let latestDir = "";
    let latestMtime = new Date(0);

    for (const dir of rwsdkDirs) {
      const fullPath = path.join(pnpmDir, dir);
      const stats = await fs.stat(fullPath);
      if (stats.mtime > latestMtime) {
        latestMtime = stats.mtime;
        latestDir = dir;
      }
    }

    console.log("   Latest rwsdk directory:", latestDir);

    if (!latestDir) {
      console.log("   🤔 Could not determine the latest rwsdk directory.");
      return;
    }

    const goldenSourcePath = path.join(
      pnpmDir,
      latestDir,
      "node_modules",
      "rwsdk",
    );

    if (!existsSync(goldenSourcePath)) {
      console.error(
        `   ❌ Golden source path does not exist: ${goldenSourcePath}`,
      );
      return;
    }
    console.log(`   🎯 Golden rwsdk path is: ${goldenSourcePath}`);

    // 1. Fix top-level symlink
    const topLevelSymlink = path.join(targetDir, "node_modules", "rwsdk");
    await fs.rm(topLevelSymlink, { recursive: true, force: true });
    await fs.symlink(goldenSourcePath, topLevelSymlink, "dir");
    console.log(`   ✅ Symlinked ${topLevelSymlink} -> ${goldenSourcePath}`);

    // 2. Fix peer dependency symlinks
    const allPnpmDirs = await fs.readdir(pnpmDir);
    for (const dir of allPnpmDirs) {
      if (dir === latestDir || !dir.includes("rwsdk")) continue;

      const peerSymlink = path.join(pnpmDir, dir, "node_modules", "rwsdk");
      if (existsSync(peerSymlink)) {
        await fs.rm(peerSymlink, { recursive: true, force: true });
        await fs.symlink(goldenSourcePath, peerSymlink, "dir");
        console.log(`   ✅ Hijacked symlink in ${dir}`);
      }
    }
  } catch (error) {
    console.error("   ❌ Failed during hacky pnpm symlink fix:", error);
  }
};

const performFullSync = async (
  sdkDir: string,
  targetDir: string,
  cacheBust = false,
) => {
  const sdkPackageJsonPath = path.join(sdkDir, "package.json");
  let originalSdkPackageJson: string | null = null;
  let tarballPath = "";
  let tarballName = "";

  try {
    if (cacheBust) {
      console.log("💥 Cache-busting version for full sync...");
      originalSdkPackageJson = await fs.readFile(sdkPackageJsonPath, "utf-8");
      const packageJson = JSON.parse(originalSdkPackageJson);
      const now = Date.now();
      // This is a temporary version used for cache busting
      packageJson.version = `${packageJson.version}-dev.${now}`;
      await fs.writeFile(
        sdkPackageJsonPath,
        JSON.stringify(packageJson, null, 2),
      );
    }

    console.log("📦 Packing SDK...");
    const packResult = await $({ cwd: sdkDir })`npm pack`;
    tarballName = packResult.stdout?.trim() ?? "";
    if (!tarballName) {
      console.error("❌ Failed to get tarball name from npm pack.");
      return;
    }
    tarballPath = path.resolve(sdkDir, tarballName);

    console.log(`💿 Installing ${tarballName} in ${targetDir}...`);

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
      if (pm.name === "pnpm") {
        console.log("🛠️  Using pnpm overrides to install SDK...");
        if (originalPackageJson) {
          const targetPackageJson = JSON.parse(originalPackageJson);
          targetPackageJson.pnpm = targetPackageJson.pnpm || {};
          targetPackageJson.pnpm.overrides =
            targetPackageJson.pnpm.overrides || {};
          targetPackageJson.pnpm.overrides.rwsdk = `file:${tarballPath}`;
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify(targetPackageJson, null, 2),
          );
        }
        // We use install here, which respects the overrides.
        // We also don't want to fail if the lockfile is out of date.
        await $("pnpm", ["install", "--no-frozen-lockfile"], {
          cwd: targetDir,
          stdio: "inherit",
        });
        if (process.env.RWSDK_PNPM_SYMLINK_FIX) {
          await hackyPnpmSymlinkFix(targetDir);
        }
      } else {
        const cmd = pm.name;
        const args = [pm.command];

        if (pm.name === "yarn") {
          args.push(`file:${tarballPath}`);
        } else {
          args.push(tarballPath);
        }

        await $(cmd, args, {
          cwd: targetDir,
          stdio: "inherit",
        });
      }
    } finally {
      if (originalPackageJson) {
        console.log("Restoring package.json...");
        await fs.writeFile(packageJsonPath, originalPackageJson);
      }
      if (originalLockfile && pm.name !== "pnpm") {
        console.log(`Restoring ${pm.lockFile}...`);
        await fs.writeFile(lockfilePath, originalLockfile);
      }
    }
  } finally {
    if (originalSdkPackageJson) {
      console.log("Restoring package.json...");
      await fs.writeFile(sdkPackageJsonPath, originalSdkPackageJson);
    }
    if (tarballPath) {
      console.log("Removing tarball...");
      await fs.unlink(tarballPath).catch(() => {
        // ignore if deletion fails
      });
    }
  }
};

const performFastSync = async (sdkDir: string, targetDir: string) => {
  console.log("⚡️ No dependency changes, performing fast sync...");

  const sdkPackageJson = JSON.parse(
    await fs.readFile(path.join(sdkDir, "package.json"), "utf-8"),
  );
  const filesToSync = sdkPackageJson.files || [];

  for (const file of filesToSync) {
    const source = path.join(sdkDir, file);
    const destination = path.join(targetDir, "node_modules/rwsdk", file);
    if (existsSync(source)) {
      await fs.cp(source, destination, { recursive: true, force: true });
    }
  }
  // Always copy package.json
  await fs.copyFile(
    path.join(sdkDir, "package.json"),
    path.join(targetDir, "node_modules/rwsdk/package.json"),
  );
};

const areDependenciesEqual = (
  deps1?: Record<string, string>,
  deps2?: Record<string, string>,
) => {
  // Simple string comparison for this use case is sufficient
  return JSON.stringify(deps1 ?? {}) === JSON.stringify(deps2 ?? {});
};

const performSync = async (sdkDir: string, targetDir: string) => {
  console.log("🏗️  Rebuilding SDK...");
  await $`pnpm build`;

  const forceFullSync = Boolean(process.env.RWSDK_FORCE_FULL_SYNC);

  if (forceFullSync) {
    console.log("🏃 Force full sync mode is enabled.");
    await performFullSync(sdkDir, targetDir, true);
    console.log("✅ Done syncing");
    return;
  }

  const sdkPackageJsonPath = path.join(sdkDir, "package.json");
  const installedSdkPackageJsonPath = path.join(
    targetDir,
    "node_modules/rwsdk/package.json",
  );

  let packageJsonChanged = true;

  if (existsSync(installedSdkPackageJsonPath)) {
    const sdkPackageJsonContent = await fs.readFile(
      sdkPackageJsonPath,
      "utf-8",
    );
    const installedSdkPackageJsonContent = await fs.readFile(
      installedSdkPackageJsonPath,
      "utf-8",
    );

    const sdkPkg = JSON.parse(sdkPackageJsonContent);
    const installedPkg = JSON.parse(installedSdkPackageJsonContent);

    if (
      areDependenciesEqual(sdkPkg.dependencies, installedPkg.dependencies) &&
      areDependenciesEqual(
        sdkPkg.devDependencies,
        installedPkg.devDependencies,
      ) &&
      areDependenciesEqual(
        sdkPkg.peerDependencies,
        installedPkg.peerDependencies,
      )
    ) {
      packageJsonChanged = false;
    }
  }

  if (packageJsonChanged) {
    console.log("📦 package.json changed, performing full sync...");
    // We always cache-bust on a full sync now to ensure pnpm's overrides
    // see a new version and the hacky symlink fix runs on a clean slate.
    await performFullSync(sdkDir, targetDir, true);
  } else {
    await performFastSync(sdkDir, targetDir);
  }

  console.log("✅ Done syncing");
};

export const debugSync = async (opts: DebugSyncOptions) => {
  const { targetDir, sdkDir = process.cwd(), watch } = opts;

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  // If not in watch mode, just do a one-time sync and exit.
  if (!watch) {
    await performSync(sdkDir, targetDir);
    return;
  }

  // --- Watch Mode Logic ---
  // Use global lock based on SDK directory since all instances sync from the same source
  const lockfilePath = path.join(sdkDir, ".rwsync.lock");
  let release: () => Promise<void>;

  // Ensure the directory for the lockfile exists
  await fs.mkdir(path.dirname(lockfilePath), { recursive: true });
  // "Touch" the file to ensure it exists before locking
  await fs.appendFile(lockfilePath, "").catch(() => {});

  try {
    release = await lock(lockfilePath, { retries: 0 });
  } catch (e: any) {
    if (e.code === "ELOCKED") {
      console.error(
        `❌ Another rwsync process is already running for this SDK.`,
      );
      console.error(
        `   If this is not correct, please remove the lockfile at ${lockfilePath}`,
      );
      process.exit(1);
    }
    throw e;
  }

  // Initial sync for watch mode. We do it *after* acquiring the lock.
  try {
    await performSync(sdkDir, targetDir);
  } catch (error) {
    console.error("❌ Initial sync failed:", error);
    console.log("   Still watching for changes...");
  }

  const filesToWatch = [
    path.join(sdkDir, "src"),
    path.join(sdkDir, "types"),
    path.join(sdkDir, "bin"),
    path.join(sdkDir, "package.json"),
  ];

  console.log("👀 Watching for changes...");

  let childProc: ReturnType<typeof $> | null = null;
  const runWatchedCommand = () => {
    if (typeof watch === "string") {
      console.log(`\n> ${watch}\n`);
      childProc = $({
        stdio: "inherit",
        shell: true,
        cwd: targetDir,
        reject: false,
      })`${watch}`;
    }
  };

  const watcher = chokidar.watch(filesToWatch, {
    ignoreInitial: true,
    cwd: sdkDir,
  });

  let syncing = false;

  // todo(justinvdm, 2025-07-22): Figure out wtf makes the full sync
  // cause chokidar to find out about package.json after sync has resolved
  let expectingFileChanges = Boolean(process.env.RWSDK_FORCE_FULL_SYNC);

  watcher.on("all", async (_event, filePath) => {
    if (syncing || filePath.endsWith(".tgz")) {
      return;
    }

    if (expectingFileChanges && process.env.RWSDK_FORCE_FULL_SYNC) {
      expectingFileChanges = false;
      return;
    }

    syncing = true;
    expectingFileChanges = true;
    console.log(`\nDetected change, re-syncing... (file: ${filePath})`);

    if (childProc && !childProc.killed) {
      console.log("Stopping running process...");
      childProc.kill();
      await childProc.catch(() => {
        /* ignore kill errors */
      });
    }
    try {
      watcher.unwatch(filesToWatch);
      await performSync(sdkDir, targetDir);
      runWatchedCommand();
    } catch (error) {
      console.error("❌ Sync failed:", error);
      console.log("   Still watching for changes...");
    } finally {
      syncing = false;
      watcher.add(filesToWatch);
    }
  });

  const cleanup = async () => {
    console.log("\nCleaning up...");
    if (childProc && !childProc.killed) {
      childProc.kill();
    }
    await release();
    process.exit();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Run the watched command even if the initial sync fails. This allows the
  // user to see application errors and iterate more quickly.
  runWatchedCommand();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const args = process.argv.slice(2);

  const watchFlagIndex = args.indexOf("--watch");
  let watchCmd: string | boolean = watchFlagIndex !== -1;
  let cmdArgs = args;

  if (watchFlagIndex !== -1) {
    if (
      watchFlagIndex + 1 < args.length &&
      !args[watchFlagIndex + 1].startsWith("--")
    ) {
      watchCmd = args[watchFlagIndex + 1];
    }
    // remove --watch and its potential command from args
    const watchArgCount = typeof watchCmd === "string" ? 2 : 1;
    cmdArgs = args.filter(
      (_, i) => i < watchFlagIndex || i >= watchFlagIndex + watchArgCount,
    );
  }

  const targetDir = cmdArgs[0] ?? process.cwd();
  const sdkDir = path.resolve(__dirname, "..", "..");

  debugSync({
    targetDir,
    sdkDir,
    watch: watchCmd,
  });
}
