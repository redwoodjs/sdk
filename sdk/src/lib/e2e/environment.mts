import { createHash } from "crypto";
import debug from "debug";
import { copy, pathExists } from "fs-extra";
import ignore from "ignore";
import * as fs from "node:fs";
import path from "node:path";
import { basename, join, relative, resolve } from "path";
import tmp from "tmp-promise";
import { $ } from "../../lib/$.mjs";
import { ROOT_DIR } from "../constants.mjs";
import { INSTALL_DEPENDENCIES_RETRIES } from "./constants.mjs";
import { retry } from "./retry.mjs";
import { PackageManager } from "./types.mjs";
import { ensureTmpDir } from "./utils.mjs";

const log = debug("rwsdk:e2e:environment");

const IS_CACHE_ENABLED = !process.env.RWSDK_E2E_CACHE_DISABLED;

if (IS_CACHE_ENABLED) {
  log("E2E test caching is enabled.");
}

async function getProjectDependencyHash(projectDir: string): Promise<string> {
  const hash = createHash("md5");
  const dependencyFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
  ];

  for (const file of dependencyFiles) {
    const filePath = path.join(projectDir, file);
    if (await pathExists(filePath)) {
      const data = await fs.promises.readFile(filePath);
      hash.update(path.basename(filePath));
      hash.update(data);
    }
  }

  return hash.digest("hex");
}

export async function getFilesRecursively(
  directory: string,
): Promise<string[]> {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? getFilesRecursively(fullPath) : fullPath;
    }),
  );
  return files.flat();
}

export async function getDirectoryHash(directory: string): Promise<string> {
  const hash = createHash("md5");
  if (!(await pathExists(directory))) {
    return "";
  }
  const files = await getFilesRecursively(directory);
  files.sort();

  for (const file of files) {
    const relativePath = path.relative(directory, file);
    const data = await fs.promises.readFile(file);
    hash.update(relativePath.replace(/\\/g, "/")); // Normalize path separators
    hash.update(data);
  }

  return hash.digest("hex");
}

const getTempDir = async (): Promise<tmp.DirectoryResult> => {
  const tmpDir = await ensureTmpDir();
  const projectsTempDir = path.join(tmpDir, "e2e-projects");
  await fs.promises.mkdir(projectsTempDir, { recursive: true });
  const tempDir = await tmp.dir({
    unsafeCleanup: true,
    tmpdir: projectsTempDir,
  });

  // context(justinvdm, 2 Nov 2025): On Windows CI, tmp.dir() can return a
  // short path (e.g., RUNNER~1). Vite's internals may later resolve this to a
  // long path (e.g., runneradmin), causing alias resolution to fail due to
  // path mismatch. Using realpathSync ensures we always use the canonical
  // path, avoiding this inconsistency.
  if (process.platform === "win32") {
    tempDir.path = fs.realpathSync.native(tempDir.path);
  }

  await fs.promises.mkdir(tempDir.path, { recursive: true });
  return tempDir;
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

const createSdkTarball = async (): Promise<{
  tarballPath: string;
  cleanupTarball: () => Promise<void>;
}> => {
  const existingTarballPath = process.env.RWSKD_SMOKE_TEST_TARBALL_PATH;

  if (existingTarballPath) {
    if (!fs.existsSync(existingTarballPath)) {
      throw new Error(
        `Provided tarball path does not exist: ${existingTarballPath}`,
      );
    }
    log(`📦 Using existing tarball: ${existingTarballPath}`);
    return {
      tarballPath: existingTarballPath,
      cleanupTarball: async () => {
        /* no-op */
      }, // No-op cleanup
    };
  }

  // Create a temporary directory to receive the tarball, ensuring a stable path.
  let tempDir = await fs.promises.mkdtemp(
    path.join(await ensureTmpDir(), "rwsdk-tarball-"),
  );

  // context(justinvdm, 2 Nov 2025): Normalize the temp dir on Windows
  // to prevent short/long path mismatches.
  if (process.platform === "win32") {
    tempDir = fs.realpathSync.native(tempDir);
  }

  await $({
    cwd: ROOT_DIR,
    stdio: "pipe",
  })`npm pack --pack-destination=${tempDir}`;

  // We need to determine the tarball's name, as it's version-dependent.
  // Running `npm pack --dry-run` gives us the filename without creating a file.
  const packDryRun = await $({
    cwd: ROOT_DIR,
    stdio: "pipe",
  })`npm pack --dry-run`;
  const tarballName = packDryRun.stdout?.trim()!;
  const tarballPath = path.join(tempDir, tarballName);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(
      `Tarball was not created in the expected location: ${tarballPath}`,
    );
  }

  log(`📦 Created tarball in stable temp location: ${tarballPath}`);

  const cleanupTarball = async () => {
    log(`🧹 Cleaning up tarball directory: ${tempDir}`);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  };

  return { tarballPath, cleanupTarball };
};

const setTarballDependency = async (
  targetDir: string,
  tarballName: string,
): Promise<void> => {
  const filePath = join(targetDir, "package.json");
  const packageJson = await fs.promises.readFile(filePath, "utf-8");
  const packageJsonContent = JSON.parse(packageJson);
  packageJsonContent.dependencies.rwsdk = `file:${tarballName}`;
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(packageJsonContent, null, 2),
  );
};

/**
 * Copy project to a temporary directory with a unique name
 */
export async function copyProjectToTempDir(
  projectDir: string,
  resourceUniqueKey: string,
  packageManager?: PackageManager,
  monorepoRoot?: string,
  installDependenciesRetries?: number,
): Promise<{
  tempDir: tmp.DirectoryResult;
  targetDir: string;
  workerName: string;
}> {
  const { tarballPath, cleanupTarball } = await createSdkTarball();
  try {
    log("Creating temporary directory for project");
    const tempDir = await getTempDir();

    // Determine the source directory to copy from
    const sourceDir = monorepoRoot || projectDir;

    // Create unique project directory name
    const originalDirName = basename(sourceDir);
    const workerName = `${slugify(originalDirName)}-test-${resourceUniqueKey}`;
    const tempCopyRoot = resolve(tempDir.path, workerName);

    // If it's a monorepo, the targetDir for commands is a subdirectory
    const targetDir = monorepoRoot
      ? resolve(tempCopyRoot, relative(monorepoRoot, projectDir))
      : tempCopyRoot;

    console.log(`Copying project from ${sourceDir} to ${tempCopyRoot}`);

    // Read project's .gitignore if it exists
    let ig = ignore();
    const gitignorePath = join(sourceDir, ".gitignore");

    if (await pathExists(gitignorePath)) {
      log("Found .gitignore file at %s", gitignorePath);
      const gitignoreContent = await fs.promises.readFile(
        gitignorePath,
        "utf-8",
      );
      ig = ig.add(gitignoreContent);
    } else {
      log("No .gitignore found, using default ignore patterns");
      // Add default ignores if no .gitignore exists
      ig = ig.add(
        [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".DS_Store",
          "coverage",
          ".cache",
          ".wrangler",
          ".env",
        ].join("\n"),
      );
    }

    // Copy the project directory, respecting .gitignore
    log("Starting copy process with ignored patterns");
    await copy(sourceDir, tempCopyRoot, {
      filter: (src) => {
        // Get path relative to project directory
        const relativePath = relative(sourceDir, src);
        if (!relativePath) return true; // Include the root directory

        // Check against ignore patterns
        const result = !ig.ignores(relativePath);
        return result;
      },
    });
    log("Project copy completed successfully");

    // Copy the SDK tarball into the target directory
    const tarballFilename = basename(tarballPath);
    const tempTarballPath = join(targetDir, tarballFilename);
    await fs.promises.copyFile(tarballPath, tempTarballPath);

    if (monorepoRoot) {
      log("⚙️  Configuring monorepo workspace...");
      const rwsdkWsPath = join(tempCopyRoot, "rwsdk-workspace.json");
      if (await pathExists(rwsdkWsPath)) {
        const rwsdkWs = JSON.parse(
          await fs.promises.readFile(rwsdkWsPath, "utf-8"),
        );
        const workspaces = rwsdkWs.workspaces;

        if (packageManager === "pnpm") {
          const pnpmWsPath = join(tempCopyRoot, "pnpm-workspace.yaml");
          const pnpmWsConfig = `packages:\n${workspaces
            .map((w: string) => `  - '${w}'`)
            .join("\n")}\n`;
          await fs.promises.writeFile(pnpmWsPath, pnpmWsConfig);
          log("Created pnpm-workspace.yaml");
        } else {
          // For npm and yarn, add a workspaces property to package.json
          const pkgJsonPath = join(tempCopyRoot, "package.json");
          const pkgJson = JSON.parse(
            await fs.promises.readFile(pkgJsonPath, "utf-8"),
          );
          pkgJson.workspaces = workspaces;
          await fs.promises.writeFile(
            pkgJsonPath,
            JSON.stringify(pkgJson, null, 2),
          );
          log("Added workspaces to package.json");
        }
      }
    }

    // Configure temp project to not use frozen lockfile
    log("⚙️  Configuring temp project to not use frozen lockfile...");
    const npmrcPath = join(targetDir, ".npmrc");
    await fs.promises.writeFile(npmrcPath, "frozen-lockfile=false\n");

    const tmpDir = await ensureTmpDir();
    if (packageManager === "yarn") {
      const yarnrcPath = join(targetDir, ".yarnrc.yml");
      const yarnCacheDir = path.join(tmpDir, "yarn-cache");
      await fs.promises.mkdir(yarnCacheDir, { recursive: true });
      const yarnConfig = [
        // todo(justinvdm, 23-09-23): Support yarn pnpm
        "nodeLinker: node-modules",
        "enableImmutableInstalls: false",
        `cacheFolder: "${yarnCacheDir.replace(/\\/g, "/")}"`,
      ].join("\n");
      await fs.promises.writeFile(yarnrcPath, yarnConfig);
      log("Created .yarnrc.yml to allow lockfile changes for yarn");
    }

    if (packageManager === "yarn-classic") {
      const yarnrcPath = join(targetDir, ".yarnrc");
      const yarnCacheDir = path.join(tmpDir, "yarn-classic-cache");
      await fs.promises.mkdir(yarnCacheDir, { recursive: true });
      const yarnConfig = `cache-folder "${yarnCacheDir.replace(/\\/g, "/")}"`;
      await fs.promises.writeFile(yarnrcPath, yarnConfig);
      log("Created .yarnrc with cache-folder for yarn-classic");
    }

    await setTarballDependency(targetDir, tarballFilename);

    // Install dependencies in the target directory
    const installDir = monorepoRoot ? tempCopyRoot : targetDir;
    await retry(
      () =>
        installDependencies(
          installDir,
          packageManager,
          projectDir,
          monorepoRoot,
        ),
      {
        retries: INSTALL_DEPENDENCIES_RETRIES,
        delay: 1000,
      },
    );

    // Return the environment details
    return { tempDir, targetDir, workerName };
  } finally {
    await cleanupTarball();
  }
}

async function installDependencies(
  targetDir: string,
  packageManager: PackageManager = "pnpm",
  projectDir: string,
  monorepoRoot?: string,
): Promise<void> {
  let cacheRoot: string | null = null;
  let nodeModulesCachePath: string | null = null;

  if (IS_CACHE_ENABLED) {
    const dependencyHash = await getProjectDependencyHash(
      monorepoRoot || projectDir,
    );

    const cacheDirName = monorepoRoot
      ? basename(monorepoRoot)
      : basename(projectDir);

    cacheRoot = path.join(
      await ensureTmpDir(),
      "rwsdk-e2e-cache",
      `${cacheDirName}-${dependencyHash.substring(0, 8)}`,
    );
    nodeModulesCachePath = path.join(cacheRoot, "node_modules");

    if (await pathExists(nodeModulesCachePath)) {
      console.log(
        `✅ CACHE HIT for dependencies: Found cached node_modules. Hard-linking from ${nodeModulesCachePath}`,
      );
      try {
        await copy(nodeModulesCachePath, join(targetDir, "node_modules"));
        console.log(`✅ Cache restored successfully.`);
        console.log(`📦 Installing local SDK into cached node_modules...`);
        // We still need to install the packed tarball
        await runInstall(targetDir, packageManager, true);
        return;
      } catch (e) {
        console.warn(
          `⚠️ Cache restore failed. Error: ${(e as Error).message}. Proceeding with clean install.`,
        );
      }
    } else {
      console.log(
        `ℹ️ CACHE MISS for dependencies: No cached node_modules found at ${nodeModulesCachePath}. Proceeding with clean installation.`,
      );
    }
  }

  await runInstall(targetDir, packageManager, false);

  if (IS_CACHE_ENABLED && nodeModulesCachePath) {
    console.log(
      `Caching node_modules to ${nodeModulesCachePath} for future runs...`,
    );
    await fs.promises.mkdir(path.dirname(nodeModulesCachePath), {
      recursive: true,
    });
    await copy(join(targetDir, "node_modules"), nodeModulesCachePath);
    console.log(`✅ node_modules cached successfully.`);
  }
}

async function runInstall(
  targetDir: string,
  packageManager: PackageManager,
  isCacheHit: boolean,
) {
  if (!isCacheHit) {
    // Clean up any pre-existing node_modules and lockfiles
    log("Cleaning up pre-existing node_modules and lockfiles...");
    await Promise.all([
      fs.promises.rm(join(targetDir, "node_modules"), {
        recursive: true,
        force: true,
      }),
      fs.promises.rm(join(targetDir, "pnpm-lock.yaml"), { force: true }),
      fs.promises.rm(join(targetDir, "yarn.lock"), { force: true }),
      fs.promises.rm(join(targetDir, "package-lock.json"), { force: true }),
    ]);
    log("Cleanup complete.");
  }

  if (packageManager.startsWith("yarn")) {
    log(`Enabling corepack...`);
    await $("corepack", ["enable"], { cwd: targetDir, stdio: "pipe" });

    if (packageManager === "yarn") {
      log(`Preparing yarn@stable with corepack...`);
      await $("corepack", ["prepare", "yarn@stable", "--activate"], {
        cwd: targetDir,
        stdio: "pipe",
      });
    } else if (packageManager === "yarn-classic") {
      log(`Preparing yarn@1.22.19 with corepack...`);
      await $("corepack", ["prepare", "yarn@1.x", "--activate"], {
        cwd: targetDir,
        stdio: "pipe",
      });
    }
  }
  const npmCacheDir = path.join(await ensureTmpDir(), "npm-cache");
  await fs.promises.mkdir(npmCacheDir, { recursive: true });

  const installCommand = {
    pnpm: ["pnpm", "install", "--reporter=silent"],
    npm: ["npm", "install", "--cache", npmCacheDir, "--silent"],
    yarn: ["yarn", "install", "--silent"],
    "yarn-classic": ["yarn", "--silent"],
  }[packageManager];

  if (isCacheHit && packageManager === "pnpm") {
    // For pnpm, a targeted `install <tarball>` is much faster
    // We need to find the tarball name first.
    const files = await fs.promises.readdir(targetDir);
    const tarball = files.find(
      (f) => f.startsWith("rwsdk-") && f.endsWith(".tgz"),
    );
    if (tarball) {
      installCommand[1] = `./${tarball}`;
    } else {
      log(
        "Could not find SDK tarball for targeted install, falling back to full install.",
      );
    }
  }

  // Run install command in the target directory
  log(`Running ${installCommand.join(" ")}`);
  const [command, ...args] = installCommand;
  await $(command, args, {
    cwd: targetDir,
    stdio: "pipe",
    env: {
      YARN_ENABLE_HARDENED_MODE: "0",
    },
  });

  console.log("✅ Dependencies installed successfully");
}
