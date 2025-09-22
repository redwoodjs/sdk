import { join } from "path";
import { setTimeout } from "node:timers/promises";
import debug from "debug";
import { mkdirp, pathExists, copy } from "fs-extra";
import * as fs from "fs/promises";
import tmp from "tmp-promise";
import ignore from "ignore";
import { relative, basename, resolve } from "path";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import { $ } from "../../lib/$.mjs";
import { debugSync } from "../../scripts/debug-sync.mjs";
import { SmokeTestOptions, TestResources, PackageManager } from "./types.mjs";
import { createHash } from "crypto";

const log = debug("rwsdk:e2e:environment");

/**
 * Sets up the test environment, preparing any resources needed for testing
 */
export async function setupTestEnvironment(
  options: SmokeTestOptions = {},
): Promise<TestResources> {
  log("Setting up test environment with options: %O", options);

  // Generate a resource unique key for this test run right at the start
  const uniqueNameSuffix = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: "-",
    length: 2,
    style: "lowerCase",
  });

  // Create a short unique hash based on the timestamp
  const hash = createHash("md5")
    .update(Date.now().toString())
    .digest("hex")
    .substring(0, 8);

  // Create a resource unique key even if we're not copying a project
  const resourceUniqueKey = `${uniqueNameSuffix}-${hash}`;

  const resources: TestResources = {
    tempDirCleanup: undefined,
    workerName: undefined,
    originalCwd: process.cwd(),
    targetDir: undefined,
    workerCreatedDuringTest: false,
    stopDev: undefined,
    resourceUniqueKey, // Set at initialization
  };

  log("Current working directory: %s", resources.originalCwd);

  try {
    // If a project dir is specified, copy it to a temp dir with a unique name
    if (options.projectDir) {
      log("Project directory specified: %s", options.projectDir);
      const { tempDir, targetDir, workerName } = await copyProjectToTempDir(
        options.projectDir,
        {
          sync: options.sync !== false, // default to true if undefined
          resourceUniqueKey,
          packageManager: options.packageManager,
          testType: "smoke",
        },
      );

      // Store cleanup function
      resources.tempDirCleanup = tempDir.cleanup;
      resources.workerName = workerName;
      resources.targetDir = targetDir;

      log("Target directory: %s", targetDir);
    } else {
      log("No project directory specified, using current directory");
      // When no project dir is specified, we'll use the current directory
      resources.targetDir = resources.originalCwd;
    }

    return resources;
  } catch (error) {
    log("Error during test environment setup: %O", error);
    throw error;
  }
}

/**
 * Copy project to a temporary directory with a unique name
 */
export async function copyProjectToTempDir(
  projectDir: string,
  options: {
    sync?: boolean;
    resourceUniqueKey: string;
    packageManager?: PackageManager;
    tarballPath?: string;
    testType?: "smoke" | "tarball";
  },
): Promise<{
  tempDir: tmp.DirectoryResult;
  targetDir: string;
  workerName: string;
}> {
  const {
    sync = true,
    resourceUniqueKey,
    packageManager,
    tarballPath,
    testType = "smoke",
  } = options;
  log("Creating temporary directory for project");
  // Create a temporary directory
  const tempDir = await tmp.dir({ unsafeCleanup: true });

  // Create unique project directory name
  const originalDirName = basename(projectDir);
  const testSuffix = testType === "tarball" ? "tarball-test" : "smoke-test";
  const workerName = `${originalDirName}-${testSuffix}-${resourceUniqueKey}`;
  const targetDir = resolve(tempDir.path, workerName);

  console.log(`Copying project from ${projectDir} to ${targetDir}`);

  // Read project's .gitignore if it exists
  let ig = ignore();
  const gitignorePath = join(projectDir, ".gitignore");

  if (await pathExists(gitignorePath)) {
    log("Found .gitignore file at %s", gitignorePath);
    const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
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
  await copy(projectDir, targetDir, {
    filter: (src) => {
      // Get path relative to project directory
      const relativePath = relative(projectDir, src);
      if (!relativePath) return true; // Include the root directory

      // Check against ignore patterns
      const result = !ig.ignores(relativePath);
      return result;
    },
  });
  log("Project copy completed successfully");

  // Tarball-specific configuration
  if (testType === "tarball") {
    // Configure temp project to not use frozen lockfile
    log("⚙️  Configuring temp project to not use frozen lockfile...");
    const npmrcPath = join(targetDir, ".npmrc");
    await fs.writeFile(npmrcPath, "frozen-lockfile=false\n");
  }

  // For yarn, create .yarnrc.yml to disable PnP and use node_modules
  if (packageManager === "yarn" || packageManager === "yarn-classic") {
    const yarnrcPath = join(targetDir, ".yarnrc.yml");
    await fs.writeFile(yarnrcPath, "nodeLinker: node-modules\n");
    log("Created .yarnrc.yml to disable PnP for yarn");
  }

  // Replace workspace:* dependencies with a placeholder before installing
  await replaceWorkspaceDependencies(targetDir);

  // Install dependencies in the target directory
  if (testType === "tarball" && tarballPath) {
    await installTarballDependencies(targetDir, packageManager, tarballPath);
  } else {
    await installDependencies(targetDir, packageManager);
  }

  // Sync SDK to the temp dir if requested (only for smoke tests)
  if (sync && testType === "smoke") {
    console.log(
      `🔄 Syncing SDK to ${targetDir} after installing dependencies...`,
    );
    await debugSync({ targetDir });
  }

  console.log(`\n🔍 Running type check in ${targetDir}...`);
  await $({
    cwd: targetDir,
    stdio: "inherit",
  })`npm run check`;
  console.log(`✅ Type check passed for ${targetDir}`);

  // Return the environment details
  return { tempDir, targetDir, workerName };
}

/**
 * Replace workspace:* dependencies with a placeholder version to allow installation
 */
async function replaceWorkspaceDependencies(targetDir: string): Promise<void> {
  const packageJsonPath = join(targetDir, "package.json");

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    let modified = false;

    // Replace workspace:* dependencies with a placeholder version
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        if (version === "workspace:*") {
          packageJson.dependencies[name] = "0.0.80"; // Use latest published version as placeholder
          modified = true;
          log(`Replaced workspace dependency ${name} with placeholder version`);
        }
      }
    }

    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(
        packageJson.devDependencies,
      )) {
        if (version === "workspace:*") {
          packageJson.devDependencies[name] = "0.0.80"; // Use latest published version as placeholder
          modified = true;
          log(
            `Replaced workspace devDependency ${name} with placeholder version`,
          );
        }
      }
    }

    if (modified) {
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      log(
        "Updated package.json with placeholder versions for workspace dependencies",
      );
    }
  } catch (error) {
    log("Error replacing workspace dependencies: %O", error);
    throw new Error(`Failed to replace workspace dependencies: ${error}`);
  }
}

/**
 * Install tarball dependencies
 */
async function installTarballDependencies(
  targetDir: string,
  packageManager: PackageManager = "pnpm",
  tarballPath: string,
): Promise<void> {
  console.log(
    `📦 Installing tarball dependencies in ${targetDir} using ${packageManager}...`,
  );

  try {
    if (packageManager === "pnpm") {
      await $({ cwd: targetDir })`pnpm add ${tarballPath}`;
    } else if (packageManager === "npm") {
      await $({ cwd: targetDir })`npm install`;
    } else if (packageManager === "yarn") {
      await $({ cwd: targetDir })`yarn add ${tarballPath}`;
    }

    console.log("✅ Tarball dependencies installed successfully");
  } catch (error) {
    log("ERROR: Failed to install tarball dependencies: %O", error);
    console.error(
      `❌ Failed to install tarball dependencies: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw new Error(
      `Failed to install tarball dependencies. Please ensure the tarball is valid.`,
    );
  }
}

/**
 * Install project dependencies using pnpm
 */
async function installDependencies(
  targetDir: string,
  packageManager: PackageManager = "pnpm",
): Promise<void> {
  console.log(
    `📦 Installing project dependencies in ${targetDir} using ${packageManager}...`,
  );

  try {
    const installCommand = {
      pnpm: ["pnpm", "install"],
      npm: ["npm", "install"],
      yarn: ["yarn", "install", "--immutable"],
      "yarn-classic": ["yarn", "install", "--immutable"],
    }[packageManager];

    // Run install command in the target directory
    log(`Running ${installCommand.join(" ")}`);
    const [command, ...args] = installCommand;
    const result = await $(command, args, {
      cwd: targetDir,
      stdio: "pipe", // Capture output
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
