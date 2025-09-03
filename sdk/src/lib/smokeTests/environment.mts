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
import { log } from "./constants.mjs";
import { debugSync } from "../../scripts/debug-sync.mjs";
import { SmokeTestOptions, TestResources } from "./types.mjs";
import { createSmokeTestComponents } from "./codeUpdates.mjs";
import { createHash } from "crypto";

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
        options.sync !== false, // default to true if undefined
        resourceUniqueKey, // Pass in the existing resourceUniqueKey
      );

      // Store cleanup function
      resources.tempDirCleanup = tempDir.cleanup;
      resources.workerName = workerName;
      resources.targetDir = targetDir;

      log("Target directory: %s", targetDir);

      // Create the smoke test components in the user's project
      log("Creating smoke test components");
      await createSmokeTestComponents(targetDir, options.skipClient);
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
  sync: boolean = true,
  resourceUniqueKey: string,
): Promise<{
  tempDir: tmp.DirectoryResult;
  targetDir: string;
  workerName: string;
}> {
  log("Creating temporary directory for project");
  // Create a temporary directory
  const tempDir = await tmp.dir({ unsafeCleanup: true });

  // Create unique project directory name
  const originalDirName = basename(projectDir);
  const workerName = `${originalDirName}-smoke-test-${resourceUniqueKey}`;
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

  // Install dependencies in the target directory
  await installDependencies(targetDir);

  // Sync SDK to the temp dir if requested
  if (sync) {
    console.log(
      `🔄 Syncing SDK to ${targetDir} after installing dependencies...`,
    );
    await debugSync({ targetDir });
  }

  return { tempDir, targetDir, workerName };
}

/**
 * Install project dependencies using pnpm
 */
async function installDependencies(targetDir: string): Promise<void> {
  console.log(`📦 Installing project dependencies in ${targetDir}...`);

  try {
    // Run pnpm install in the target directory
    log("Running pnpm install");
    const result = await $({
      cwd: targetDir,
      stdio: "pipe", // Capture output
    })`pnpm install`;

    console.log("✅ Dependencies installed successfully");

    // Log installation details at debug level
    if (result.stdout) {
      log("pnpm install output: %s", result.stdout);
    }
  } catch (error) {
    log("ERROR: Failed to install dependencies: %O", error);
    console.error(
      `❌ Failed to install dependencies: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw new Error(
      `Failed to install project dependencies. Please ensure the project can be installed with pnpm.`,
    );
  }
}
