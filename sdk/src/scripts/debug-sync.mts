import chokidar from "chokidar";
import { $ } from "execa";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lock } from "proper-lockfile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Any change triggers an update; no publish file list caching needed

export interface DebugSyncOptions {
  targetDir: string;
  sdkDir?: string;
  watch?: string | boolean;
}

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

const findUp = async (
  names: string[],
  startDir: string,
): Promise<string | undefined> => {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    for (const name of names) {
      const filePath = path.join(dir, name);
      if (existsSync(filePath)) {
        return dir;
      }
    }
    dir = path.dirname(dir);
  }
  return undefined;
};

const getMonorepoRoot = async (startDir: string) => {
  try {
    // `pnpm root` is the most reliable way to find the workspace root node_modules
    const { stdout } = await $({
      cwd: startDir,
    })`pnpm root`;
    // pnpm root returns the node_modules path, so we go up one level
    return path.resolve(stdout, "..");
  } catch (e) {
    console.warn(
      `Could not determine pnpm root from ${startDir}. Falling back to file search.`,
    );
    const root = await findUp(["pnpm-workspace.yaml"], startDir);
    if (root) {
      return root;
    }
  }

  console.warn(
    "Could not find pnpm monorepo root. Using parent directory of target as fallback.",
  );
  return path.resolve(startDir, "..");
};

const areDependenciesEqual = (
  deps1?: Record<string, string>,
  deps2?: Record<string, string>,
) => {
  // Simple string comparison for this use case is sufficient
  return JSON.stringify(deps1 ?? {}) === JSON.stringify(deps2 ?? {});
};

const performFullSync = async (
  sdkDir: string,
  targetDir: string,
  monorepoRoot: string,
) => {
  console.log("📦 Performing full sync with tarball...");
  let tarballPath = "";

  const projectName = path.basename(targetDir);
  const rwsyncDir = path.join(
    monorepoRoot,
    "node_modules",
    `.rwsync_${projectName}`,
  );

  try {
    // 1. Pack the SDK
    const packResult = await $({ cwd: sdkDir })`npm pack --json`;
    const json = JSON.parse(packResult.stdout || "[]");
    const packInfo = Array.isArray(json) ? json[0] : undefined;
    const tarballName =
      (packInfo && (packInfo.filename || packInfo.name)) || "";
    if (!tarballName) {
      throw new Error("Failed to get tarball name from npm pack.");
    }
    tarballPath = path.resolve(sdkDir, tarballName);

    // 2. Prepare isolated install directory
    console.log(`Preparing isolated install directory at ${rwsyncDir}`);
    await fs.rm(rwsyncDir, { recursive: true, force: true });
    await fs.mkdir(rwsyncDir, { recursive: true });
    await fs.writeFile(
      path.join(rwsyncDir, "package.json"),
      JSON.stringify({ name: `rwsync-env-${projectName}` }, null, 2),
    );

    // 3. Perform isolated install
    console.log(`Installing ${tarballName} in isolation...`);
    await $("pnpm", ["add", tarballPath], {
      cwd: rwsyncDir,
      stdio: "inherit",
    });

    // 4. Create symlink
    const symlinkSource = path.join(rwsyncDir, "node_modules", "rwsdk");
    const symlinkTarget = path.join(targetDir, "node_modules", "rwsdk");

    console.log(`Symlinking ${symlinkTarget} -> ${symlinkSource}`);
    await fs.rm(symlinkTarget, { recursive: true, force: true });
    await fs.mkdir(path.dirname(symlinkTarget), { recursive: true });
    await fs.symlink(symlinkSource, symlinkTarget, "dir");
  } finally {
    if (tarballPath) {
      console.log("Removing tarball...");
      await fs.unlink(tarballPath).catch(() => {});
    }
  }
};

const performFastSync = async (
  sdkDir: string,
  targetDir: string,
  monorepoRoot: string,
) => {
  console.log("⚡️ Performing fast sync with rsync...");

  const projectName = path.basename(targetDir);
  const rwsyncDir = path.join(
    monorepoRoot,
    "node_modules",
    `.rwsync_${projectName}`,
  );
  const syncDestDir = path.join(rwsyncDir, "node_modules", "rwsdk");

  // Copy directories/files declared in package.json#files (plus package.json)
  const filesToSync =
    JSON.parse(await fs.readFile(path.join(sdkDir, "package.json"), "utf-8"))
      .files || [];

  await syncFilesWithRsyncOrFs(sdkDir, syncDestDir, filesToSync);
};

const performSync = async (sdkDir: string, targetDir: string) => {
  console.log("🏗️  Rebuilding SDK...");
  await $`pnpm build`;

  // Clean up vite cache in the target project
  await cleanupViteEntries(targetDir);

  const monorepoRoot = await getMonorepoRoot(targetDir);
  const projectName = path.basename(targetDir);

  const installedSdkPackageJsonPath = path.join(
    monorepoRoot,
    "node_modules",
    `.rwsync_${projectName}`,
    "node_modules",
    "rwsdk",
    "package.json",
  );

  let needsFullSync = false;
  if (!existsSync(installedSdkPackageJsonPath)) {
    console.log("No previous sync found, performing full sync.");
    needsFullSync = true;
  } else {
    const sdkPackageJson = JSON.parse(
      await fs.readFile(path.join(sdkDir, "package.json"), "utf-8"),
    );
    const installedSdkPackageJson = JSON.parse(
      await fs.readFile(installedSdkPackageJsonPath, "utf-8"),
    );

    if (
      !areDependenciesEqual(
        sdkPackageJson.dependencies,
        installedSdkPackageJson.dependencies,
      ) ||
      !areDependenciesEqual(
        sdkPackageJson.devDependencies,
        installedSdkPackageJson.devDependencies,
      )
    ) {
      console.log("Dependency changes detected, performing full sync.");
      needsFullSync = true;
    }
  }

  if (needsFullSync) {
    await performFullSync(sdkDir, targetDir, monorepoRoot);
  } else {
    await performFastSync(sdkDir, targetDir, monorepoRoot);
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
