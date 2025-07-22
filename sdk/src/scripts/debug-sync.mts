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
    } finally {
      if (originalPackageJson) {
        console.log("Restoring package.json...");
        await fs.writeFile(packageJsonPath, originalPackageJson);
      }
      if (originalLockfile) {
        console.log(`Restoring ${pm.lockFile}...`);
        await fs.writeFile(lockfilePath, originalLockfile);
      }
    }
  } finally {
    if (originalSdkPackageJson) {
      await fs.writeFile(sdkPackageJsonPath, originalSdkPackageJson);
    }
    if (tarballPath) {
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

    if (sdkPackageJsonContent === installedSdkPackageJsonContent) {
      packageJsonChanged = false;
    }
  }

  if (packageJsonChanged) {
    console.log("📦 package.json changed, performing full sync...");
    await performFullSync(sdkDir, targetDir);
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
  const lockfilePath = path.join(targetDir, "node_modules", ".rwsync.lock");
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
        `❌ Another rwsync process is already watching ${targetDir}.`,
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

  watcher.on("all", async () => {
    console.log("\nDetected change, re-syncing...");
    if (childProc && !childProc.killed) {
      console.log("Stopping running process...");
      childProc.kill();
      await childProc.catch(() => {
        /* ignore kill errors */
      });
    }
    try {
      await performSync(sdkDir, targetDir);
      runWatchedCommand();
    } catch (error) {
      console.error("❌ Sync failed:", error);
      console.log("   Still watching for changes...");
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
