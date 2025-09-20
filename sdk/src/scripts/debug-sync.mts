import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "execa";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import chokidar from "chokidar";
import { lock } from "proper-lockfile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Any change triggers an update; no publish file list caching needed

export interface DebugSyncOptions {
  targetDir: string;
  sdkDir?: string;
  watch?: string | boolean;
}

const getPackageManagerInfo = (targetDir: string) => {
  if (existsSync(path.join(targetDir, "bun.lock"))) {
    return { name: "bun", lockFile: "bun.lock", command: "add" };
  }
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

const cleanupViteEntries = async (targetDir: string) => {
  const nodeModulesDir = path.join(targetDir, "node_modules");
  if (!existsSync(nodeModulesDir)) {
    return;
  }

  try {
    const entries = await fs.readdir(nodeModulesDir);
    const viteEntries = entries.filter((entry) => entry.startsWith(".vite"));

    for (const entry of viteEntries) {
      const entryPath = path.join(nodeModulesDir, entry);
      try {
        const stat = await fs.lstat(entryPath);
        if (!stat.isSymbolicLink()) {
          console.log(`Removing vite cache entry: ${entry}`);
          await fs.rm(entryPath, { recursive: true, force: true });
        } else {
          console.log(`Skipping symlinked vite cache entry: ${entry}`);
        }
      } catch {
        // If we can't stat it, try to remove it
        console.log(`Removing vite cache entry: ${entry}`);
        await fs.rm(entryPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.log(`Failed to cleanup vite cache entries: ${error}`);
  }
};

const performFullSync = async (sdkDir: string, targetDir: string) => {
  let tarballPath = "";
  let tarballName = "";

  // Clean up vite cache
  await cleanupViteEntries(targetDir);

  try {
    console.log("📦 Packing SDK...");
    const packResult = await $({ cwd: sdkDir })`npm pack --json`;
    const json = JSON.parse(packResult.stdout || "[]");
    const packInfo = Array.isArray(json) ? json[0] : undefined;
    tarballName = (packInfo && (packInfo.filename || packInfo.name)) || "";
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
      // For bun, we need to remove the existing dependency from package.json
      // before adding the tarball to avoid a dependency loop error.
      if (pm.name === "bun" && originalPackageJson) {
        try {
          const targetPackageJson = JSON.parse(originalPackageJson);
          let modified = false;
          // Handle both old and new package names
          if (targetPackageJson.dependencies?.rwsdk) {
            delete targetPackageJson.dependencies.rwsdk;
            modified = true;
          }
          if (targetPackageJson.devDependencies?.rwsdk) {
            delete targetPackageJson.devDependencies.rwsdk;
            modified = true;
          }
          if (targetPackageJson.dependencies?.["rwsdk"]) {
            delete targetPackageJson.dependencies["rwsdk"];
            modified = true;
          }
          if (targetPackageJson.devDependencies?.["rwsdk"]) {
            delete targetPackageJson.devDependencies["rwsdk"];
            modified = true;
          }
          if (modified) {
            console.log(
              "Temporarily removing SDK dependency from target package.json to prevent dependency loop with bun.",
            );
            await fs.writeFile(
              packageJsonPath,
              JSON.stringify(targetPackageJson, null, 2),
            );
          }
        } catch (e) {
          console.warn(
            "Could not modify target package.json, proceeding anyway.",
          );
        }
      }
      const cmd = pm.name;
      const args = [pm.command];

      if (pm.name === "yarn") {
        // For modern yarn, disable PnP to avoid resolution issues with local tarballs
        process.env.YARN_NODE_LINKER = "node-modules";
        args.push(`rwsdk@file:${tarballPath}`);
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
    if (tarballPath) {
      console.log("Removing tarball...");
      await fs.unlink(tarballPath).catch(() => {
        // ignore if deletion fails
      });
    }
  }
};

const syncFilesWithRsyncOrFs = async (
  sdkDir: string,
  destDir: string,
  filesEntries: string[],
) => {
  const sources = filesEntries.map((p) => path.join(sdkDir, p));

  // Always include package.json in sync
  const pkgJsonPath = path.join(sdkDir, "package.json");
  sources.push(pkgJsonPath);

  await fs.mkdir(destDir, { recursive: true });

  // Try rsync across all sources in one shot
  try {
    if (sources.length > 0) {
      const rsyncArgs = [
        "-a",
        "--delete",
        "--omit-dir-times",
        "--no-perms",
        "--no-owner",
        "--no-group",
        ...sources,
        destDir + path.sep,
      ];
      await $({ stdio: "inherit" })("rsync", rsyncArgs);
      return;
    }
  } catch {
    // fall through to fs fallback
  }

  console.log("Rsync failed, falling back to fs");
  // Fallback: destructive copy using Node fs to mirror content
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });

  for (const src of sources) {
    const rel = path.relative(sdkDir, src);
    const dst = path.join(destDir, rel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    try {
      const stat = await fs.lstat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dst, { recursive: true, force: true });
      } else {
        await fs.copyFile(src, dst);
      }
    } catch {
      await fs.cp(src, dst, { recursive: true, force: true }).catch(() => {});
    }
  }
};

const performFastSync = async (sdkDir: string, targetDir: string) => {
  console.log("⚡️ No dependency changes, performing fast sync...");

  // Clean up vite cache
  await cleanupViteEntries(targetDir);

  const nodeModulesPkgDir = path.join(targetDir, "node_modules", "rwsdk");

  // Copy directories/files declared in package.json#files (plus package.json)
  const filesToSync =
    JSON.parse(await fs.readFile(path.join(sdkDir, "package.json"), "utf-8"))
      .files || [];

  await syncFilesWithRsyncOrFs(sdkDir, nodeModulesPkgDir, filesToSync);
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
    await performFullSync(sdkDir, targetDir);
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

    packageJsonChanged =
      sdkPackageJsonContent !== installedSdkPackageJsonContent;
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

  let syncing = false;
  let pendingResync = false;

  const triggerResync = async (reason?: string) => {
    if (syncing) {
      pendingResync = true;
      return;
    }

    syncing = true;

    if (reason) {
      console.log(`\nDetected change, re-syncing... (file: ${reason})`);
    } else {
      console.log(`\nDetected change, re-syncing...`);
    }

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
    } finally {
      syncing = false;
    }

    if (pendingResync) {
      pendingResync = false;
      // Coalesce any rapid additional events into a single follow-up sync
      await new Promise((r) => setTimeout(r, 50));
      return triggerResync();
    }
  };

  watcher.on("all", async (_event, filePath) => {
    if (filePath.endsWith(".tgz")) {
      return;
    }

    await triggerResync(filePath);
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
