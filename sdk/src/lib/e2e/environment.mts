import debug from "debug";
import { copy, pathExists } from "fs-extra";
import ignore from "ignore";
import * as fs from "node:fs";
import path from "node:path";
import os from "os";
import { basename, join, relative, resolve } from "path";
import tmp from "tmp-promise";
import { $ } from "../../lib/$.mjs";
import { ROOT_DIR } from "../constants.mjs";
import { retry } from "./retry.mjs";
import { PackageManager } from "./types.mjs";

const log = debug("rwsdk:e2e:environment");

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
  const packResult = await $({ cwd: ROOT_DIR, stdio: "pipe" })`npm pack`;
  const tarballName = packResult.stdout?.trim()!;
  const tarballPath = path.join(ROOT_DIR, tarballName);

  log(`📦 Created tarball: ${tarballPath}`);

  const cleanupTarball = async () => {
    if (fs.existsSync(tarballPath)) {
      log(`🧹 Cleaning up tarball: ${tarballPath}`);
      await fs.promises.rm(tarballPath, { force: true });
    }
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
): Promise<{
  tempDir: tmp.DirectoryResult;
  targetDir: string;
  workerName: string;
}> {
  const { tarballPath, cleanupTarball } = await createSdkTarball();
  try {
    log("Creating temporary directory for project");
    // Create a temporary directory
    const tempDir = await tmp.dir({ unsafeCleanup: true });

    // Determine the source directory to copy from
    const sourceDir = monorepoRoot || projectDir;

    // Create unique project directory name
    const originalDirName = basename(sourceDir);
    const workerName = `${originalDirName}-test-${resourceUniqueKey}`;
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
          const pnpmWsConfig = `packages:\n${workspaces.map((w: string) => `  - '${w}'`).join("\n")}\n`;
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

    // For yarn, create .yarnrc.yml to disable PnP and allow lockfile changes
    if (packageManager === "yarn") {
      const yarnrcPath = join(targetDir, ".yarnrc.yml");
      const yarnCacheDir = path.join(os.tmpdir(), "yarn-cache");
      await fs.promises.mkdir(yarnCacheDir, { recursive: true });
      const yarnConfig = [
        // todo(justinvdm, 23-09-23): Support yarn pnpm
        "nodeLinker: node-modules",
        "enableImmutableInstalls: false",
        `cacheFolder: "${yarnCacheDir}"`,
      ].join("\n");
      await fs.promises.writeFile(yarnrcPath, yarnConfig);
      log("Created .yarnrc.yml to allow lockfile changes for yarn");
    }

    await setTarballDependency(targetDir, tarballFilename);

    // Install dependencies in the target directory
    const installDir = monorepoRoot ? tempCopyRoot : targetDir;
    await retry(() => installDependencies(installDir, packageManager), {
      retries: 3,
      delay: 1000,
    });

    // Return the environment details
    return { tempDir, targetDir, workerName };
  } finally {
    await cleanupTarball();
  }
}

async function installDependencies(
  targetDir: string,
  packageManager: PackageManager = "pnpm",
): Promise<void> {
  console.log(
    `📦 Installing project dependencies in ${targetDir} using ${packageManager}...`,
  );

  try {
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
    const npmCacheDir = path.join(os.tmpdir(), "npm-cache");
    await fs.promises.mkdir(npmCacheDir, { recursive: true });

    const installCommand = {
      pnpm: ["pnpm", "install"],
      npm: ["npm", "install", "--cache", npmCacheDir],
      yarn: ["yarn", "install"],
      "yarn-classic": ["yarn"],
    }[packageManager];

    // Run install command in the target directory
    log(`Running ${installCommand.join(" ")}`);
    const [command, ...args] = installCommand;
    const result = await $(command, args, {
      cwd: targetDir,
      stdio: "pipe", // Capture output
      env: {
        YARN_ENABLE_HARDENED_MODE: "0",
      },
    });

    console.log("✅ Dependencies installed successfully");

    // Log installation details at debug level
    if (result.stdout) {
      log(`${packageManager} install output: %s`, result.stdout);
    }
  } catch (error) {
    log("ERROR: Failed to install dependencies: %O", error);
    console.error(
      `❌ Failed to install dependencies: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw new Error(
      `Failed to install project dependencies. Please ensure the project can be installed with ${packageManager}.`,
    );
  }
}
