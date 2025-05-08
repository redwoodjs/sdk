import { $ } from "../lib/$.mjs";
import puppeteer from "puppeteer-core";
import { setTimeout } from "node:timers/promises";
import { resolve, basename, join, relative } from "path";
import { fileURLToPath } from "url";
import * as process from "process";
import * as fs from "fs/promises";
import * as os from "os";
import {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
  Browser as PuppeteerBrowser,
  InstallOptions,
  resolveBuildId,
} from "@puppeteer/browsers";
import type { Page, Browser } from "puppeteer-core";
import { copy, mkdirp, pathExists } from "fs-extra";
import tmp from "tmp-promise";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import ignore from "ignore";
import debug from "debug";
import { debugSync } from "./debug-sync.mjs";
import { execaCommand } from "execa";

// Helper function to detect if running in CI environment
function isRunningInCI(ciFlag = false): boolean {
  return (
    ciFlag ||
    !!process.env.CI ||
    !!process.env.GITHUB_ACTIONS ||
    !!process.env.GITLAB_CI ||
    !!process.env.CIRCLECI
  );
}

if (!process.env.DEBUG) {
  debug.enable("rwsdk:smoke");
}

const log = debug("rwsdk:smoke");

const TIMEOUT = 30000; // 30 seconds timeout
const RETRIES = 3;

// Known Cloudflare account ID - default to RedwoodJS account if we need one
const REDWOODJS_ACCOUNT_ID = "1634a8e653b2ce7e0f7a23cca8cbd86a";

interface SmokeTestResult {
  status: string;
  verificationPassed: boolean;
  timestamp?: number;
  rawResult?: unknown;
  error?: string;
  serverTimestamp?: number;
  clientTimestamp?: number;
}

interface SmokeTestOptions {
  customPath?: string;
  skipDev?: boolean;
  skipRelease?: boolean;
  skipClient?: boolean;
  projectDir?: string;
  artifactDir?: string;
  keep?: boolean;
  headless?: boolean;
  sync?: boolean;
  ci?: boolean;
  bail?: boolean;
}

interface TestResources {
  tempDirCleanup?: () => Promise<void>;
  workerName?: string;
  originalCwd: string;
  targetDir?: string;
  workerCreatedDuringTest: boolean;
  stopDev?: () => Promise<void>;
}

// Module-level state to track resources and teardown status
const state = {
  isTearingDown: false,
  exitCode: 0,
  resources: {
    tempDirCleanup: undefined,
    workerName: undefined,
    originalCwd: process.cwd(),
    targetDir: undefined,
    workerCreatedDuringTest: false,
    stopDev: undefined,
  } as TestResources,
  options: {} as SmokeTestOptions,
  // Add a new failures array to track all failures
  failures: [] as { step: string; error: string; details?: string }[],
};

/**
 * Handles test failure by logging the error and initiating teardown
 */
async function fail(
  error: unknown,
  exitCode = 1,
  step?: string,
): Promise<never> {
  state.exitCode = exitCode;
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`❌ Smoke test failed: ${msg}`);
  log("Test failed with error: %O", error);

  // Record the failure if a step is provided
  if (step) {
    state.failures.push({
      step,
      error: msg,
      details: error instanceof Error && error.stack ? error.stack : undefined,
    });
  }

  await teardown();
  return process.exit(exitCode) as never;
}

/**
 * Handles resource teardown and exits the process with appropriate exit code
 */
async function teardown(): Promise<void> {
  // Prevent multiple teardowns running simultaneously
  if (state.isTearingDown) {
    log("Teardown already in progress, skipping duplicate call");
    return;
  }

  state.isTearingDown = true;
  log("Starting teardown process with exit code: %d", state.exitCode);

  try {
    await cleanupResources(state.resources, state.options);

    // Add failures to the report file
    if (state.resources.targetDir && state.options.artifactDir) {
      try {
        // Use the standardized reports directory
        const reportDir = join(state.options.artifactDir, "reports");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const reportPath = join(
          reportDir,
          `smoke-test-report-${timestamp}.json`,
        );

        // Create more detailed report with failures
        const report = {
          timestamp,
          success: state.exitCode === 0,
          exitCode: state.exitCode,
          // Use a simpler approach with type assertion to avoid the linter error
          workerName: (state.resources.workerName || null) as string | null,
          projectDir: join(state.options.artifactDir, "project"),
          failures: state.failures,
          options: {
            customPath: state.options.customPath,
            skipDev: state.options.skipDev,
            skipRelease: state.options.skipRelease,
          },
        };

        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        log("Wrote test report to %s", reportPath);
        console.log(`📝 Test report saved to ${reportPath}`);
      } catch (reportError) {
        log("Error writing test report: %O", reportError);
        // Non-fatal error, continue
      }
    }

    // Report a summary of all failures at the end
    if (state.failures.length > 0) {
      console.log("\n📋 Smoke Test Failure Summary:");
      console.log("================================");

      state.failures.forEach((failure, index) => {
        console.log(`Failure #${index + 1}: ${failure.step}`);
        console.log(`Error: ${failure.error}`);
        console.log("--------------------------------");
      });

      console.log(`\n❌ Total failures: ${state.failures.length}`);
    } else if (state.exitCode === 0) {
      console.log("✨ Smoke test completed successfully!");
    }
  } catch (error) {
    log("Error during teardown: %O", error);
    console.error(
      `Error during teardown: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Set exit code to 1 if it wasn't already set
    if (state.exitCode === 0) state.exitCode = 1;
  } finally {
    process.exit(state.exitCode);
  }
}

/**
 * Main function that orchestrates the smoke test flow
 */
async function main(options: SmokeTestOptions = {}): Promise<void> {
  log("Starting smoke test with options: %O", options);

  // Store options in state for future reference
  state.options = options;

  // Set default artifacts directory if not specified
  if (!options.artifactDir) {
    options.artifactDir = join(process.cwd(), ".artifacts");
    log("Using default artifacts directory: %s", options.artifactDir);
  }

  // Clean and recreate artifacts directory
  await setupArtifactsDirectory(options.artifactDir);

  // Throw immediately if both tests would be skipped
  if (options.skipDev && options.skipRelease) {
    log("Error: Both dev and release tests are skipped");
    await fail(
      new Error(
        "Cannot skip both dev and release tests. At least one must run.",
      ),
      1,
      "Configuration",
    );
  }

  // Prepare browser early to avoid waiting later
  console.log("🔍 Preparing browser for testing...");
  let browserPath;
  try {
    browserPath = await getBrowserPath(options);
    console.log(`✅ Browser ready at: ${browserPath}`);
  } catch (error) {
    await fail(error, 1, "Browser Preparation");
  }

  log("Setting up test environment");
  try {
    const resources = await setupTestEnvironment(options);
    // Store resources in module-level state
    state.resources = resources;

    // Track failures to determine final exit code
    let hasFailures = false;

    // Run the tests that weren't skipped
    if (!options.skipDev) {
      log("Starting development server");
      try {
        // Start the dev server first, store the stop function in resources
        const { url, stopDev } = await runDevServer(resources.targetDir);
        resources.stopDev = stopDev;
        state.resources.stopDev = stopDev;

        log("Running development server tests");
        await runDevTest(
          url,
          options.artifactDir,
          options.customPath,
          browserPath,
          options.headless !== false,
          options.bail,
          options.skipClient,
        );
      } catch (error) {
        hasFailures = true;
        log("Error during development server testing: %O", error);
        console.error(
          `❌ Development server test failed: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Record the failure
        state.failures.push({
          step: "Development Server Test",
          error: error instanceof Error ? error.message : String(error),
          details:
            error instanceof Error && error.stack ? error.stack : undefined,
        });

        // If bail option is true, stop the tests
        if (options.bail) {
          await fail(error, 1, "Development Server Test");
        }

        // Otherwise, continue with the release test
        console.log(
          "Continuing with next tests since --bail is not enabled...",
        );
      }
    } else {
      log("Skipping development server tests");
    }

    if (!options.skipRelease) {
      log("Running release/production tests");
      try {
        await runReleaseTest(
          options.customPath,
          options.artifactDir,
          resources,
          browserPath,
          options.headless !== false,
          options.bail,
          options.skipClient,
        );
      } catch (error) {
        hasFailures = true;
        log("Error during release testing: %O", error);
        console.error(
          `❌ Release test failed: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Record the failure
        state.failures.push({
          step: "Release Test",
          error: error instanceof Error ? error.message : String(error),
          details:
            error instanceof Error && error.stack ? error.stack : undefined,
        });

        // If bail option is true, stop the tests
        if (options.bail) {
          await fail(error, 1, "Release Test");
        }
      }
    } else {
      log("Skipping release/production tests");
    }

    // Set the exit code based on whether there were failures
    if (hasFailures) {
      state.exitCode = 1;
      console.log(
        "\n⚠️ Some smoke tests failed, but continued running since --bail was not enabled.",
      );
    } else {
      console.log("\n✅ All smoke tests passed!");
    }

    // Call teardown with the final exit code
    await teardown();
  } catch (error) {
    await fail(error, 1, "Test Environment Setup");
  }
}

/**
 * Sets up the artifacts directory with a clean structure
 */
async function setupArtifactsDirectory(artifactDir: string): Promise<void> {
  log("Setting up artifacts directory: %s", artifactDir);
  console.log(`📁 Setting up artifacts directory: ${artifactDir}`);

  // Check if directory exists
  const exists = await pathExists(artifactDir);
  if (exists) {
    log("Artifacts directory already exists, removing it");
    console.log(`🧹 Cleaning existing artifacts directory`);
    try {
      await fs.rm(artifactDir, { recursive: true, force: true });
    } catch (error) {
      log("Error removing existing artifacts directory: %O", error);
      console.error(
        `⚠️ Could not remove existing artifacts directory: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-fatal error, continue
    }
  }

  // Create main artifacts directory
  await mkdirp(artifactDir);
  log("Created artifacts directory: %s", artifactDir);

  // Create standard subdirectories
  const subdirs = ["project", "screenshots", "reports"];
  for (const subdir of subdirs) {
    const dirPath = join(artifactDir, subdir);
    await mkdirp(dirPath);
    log("Created artifacts subdirectory: %s", dirPath);
  }

  console.log(`✅ Artifacts directory structure created`);
}

/**
 * Sets up the test environment, preparing any resources needed for testing
 */
async function setupTestEnvironment(options: {
  customPath?: string;
  skipDev?: boolean;
  skipRelease?: boolean;
  skipClient?: boolean;
  projectDir?: string;
  artifactDir?: string;
  sync?: boolean;
}): Promise<TestResources> {
  log("Setting up test environment with options: %O", options);

  const resources: TestResources = {
    tempDirCleanup: undefined,
    workerName: undefined,
    originalCwd: process.cwd(),
    targetDir: undefined,
    workerCreatedDuringTest: false,
    stopDev: undefined,
  };

  log("Current working directory: %s", resources.originalCwd);

  try {
    // If a project dir is specified, copy it to a temp dir with a unique name
    if (options.projectDir) {
      log("Project directory specified: %s", options.projectDir);
      const { tempDir, targetDir, workerName } = await copyProjectToTempDir(
        options.projectDir,
        options.sync !== false, // default to true if undefined
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
    await fail(error);
    throw error; // This will never be reached due to fail() exiting
  }
}

/**
 * Runs tests against the development server
 */
async function runDevTest(
  url: string,
  artifactDir: string,
  customPath: string = "/",
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
): Promise<void> {
  log("Starting dev server test with path: %s", customPath || "/");
  console.log("🚀 Testing local development server");

  try {
    // DRY: check both root and custom path
    await checkServerUp(url, customPath);

    // Now run the tests with the custom path
    const testUrl =
      url +
      (customPath === "/"
        ? ""
        : customPath.startsWith("/")
          ? customPath
          : "/" + customPath);
    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
    );
    log("Development server test completed successfully");
  } catch (error) {
    // Add more context about the specific part that failed
    if (error instanceof Error && error.message.includes("Server at")) {
      state.failures.push({
        step: "Development Server Availability",
        error: error.message,
        details: error.stack,
      });
    }
    log("Error during development server testing: %O", error);
    throw error;
  }
}

/**
 * Runs tests against the production deployment
 */
async function runReleaseTest(
  customPath: string = "/",
  artifactDir: string,
  resources?: Partial<TestResources>,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
): Promise<void> {
  log("Starting release test with path: %s", customPath || "/");
  console.log("\n🚀 Testing production deployment");

  try {
    log("Running release process");
    const { url, workerName } = await runRelease(resources?.targetDir);

    // Wait a moment before checking server availability
    log("Waiting 1s before checking server...");
    await setTimeout(1000);

    // DRY: check both root and custom path
    await checkServerUp(url, customPath);

    // Now run the tests with the custom path
    const testUrl =
      url +
      (customPath === "/"
        ? ""
        : customPath.startsWith("/")
          ? customPath
          : "/" + customPath);
    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
    );
    log("Release test completed successfully");

    // Store the worker name if we didn't set it earlier
    if (resources && !resources.workerName) {
      log("Storing worker name: %s", workerName);
      resources.workerName = workerName;
    }

    // Mark that we created this worker during the test
    if (resources) {
      log("Marking worker %s as created during this test", workerName);
      resources.workerCreatedDuringTest = true;

      // Update the global state
      if (state.resources === resources) {
        state.resources.workerName = workerName;
        state.resources.workerCreatedDuringTest = true;
      }
    }
  } catch (error) {
    log("Error during release testing: %O", error);
    throw error;
  }
}

/**
 * Cleans up any resources used during testing
 */
async function cleanupResources(
  resources: TestResources,
  options: SmokeTestOptions,
): Promise<void> {
  log("Cleaning up resources");

  const inCIMode = isRunningInCI(options.ci);

  // Stop dev server if it was started
  if (resources.stopDev) {
    console.log("Stopping development server...");
    try {
      // Set a timeout for the stopDev function
      const stopTimeout = 10000; // 10 seconds
      await Promise.race([
        resources.stopDev(),
        (async () => {
          await setTimeout(stopTimeout);
          log("Timed out waiting for dev server to stop, continuing cleanup");
          console.log("⚠️ Timed out waiting for development server to stop");

          // Record this issue
          state.failures.push({
            step: "Development Server Shutdown",
            error:
              "Timed out waiting for development server to stop after 10 seconds",
          });

          // If the dev server didn't stop in time, we'll continue with cleanup
          return null;
        })(),
      ]);
    } catch (error) {
      log("Error while stopping development server: %O", error);
      console.error(
        `Error while stopping development server: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "Development Server Shutdown",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  }

  // Clean up resources
  if (resources.workerName && resources.workerCreatedDuringTest) {
    console.log(`🧹 Cleaning up: Deleting worker ${resources.workerName}...`);
    try {
      await deleteWorker(resources.workerName, resources.targetDir);
    } catch (error) {
      log("Error while deleting worker: %O", error);
      console.error(
        `Error while deleting worker: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: `Worker Deletion: ${resources.workerName}`,
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  } else if (resources.workerName) {
    log(
      "Not deleting worker %s as it was not created during this test",
      resources.workerName,
    );
  }

  // Always copy test directory to artifact directory if targetDir exists
  if (resources.targetDir && options.artifactDir) {
    try {
      // Use the standardized project directory
      const projectDir = join(options.artifactDir, "project");
      // Ensure directory exists
      await mkdirp(projectDir);

      // Use a simple project directory name without timestamp
      const testResult = state.exitCode === 0 ? "passed" : "failed";
      const artifactTargetDir = projectDir;

      log(
        "Copying test directory to artifacts: %s → %s",
        resources.targetDir,
        artifactTargetDir,
      );
      console.log(
        `📦 Copying test directory to artifacts: ${artifactTargetDir}`,
      );

      // Remove existing project directory if it exists
      if (await pathExists(artifactTargetDir)) {
        await fs.rm(artifactTargetDir, { recursive: true, force: true });
      }

      // Use direct copying instead of git-aware copying
      await copy(resources.targetDir, artifactTargetDir);
      log("Project directory copied successfully");

      console.log(
        `✅ Test directory copied to artifacts: ${artifactTargetDir}`,
      );

      // Note: Report generation moved to teardown function
    } catch (error) {
      log("Error copying test directory to artifacts: %O", error);
      console.error(
        `Error copying test directory to artifacts: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "Artifact Copy",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  }

  // Clean up temporary directory only if keep flag is false and not in CI mode
  if (resources.tempDirCleanup && !options.keep && !inCIMode) {
    log("Cleaning up temporary directory");
    try {
      await resources.tempDirCleanup();
      log("Temporary directory cleaned up");
    } catch (error) {
      log("Error while cleaning up temporary directory: %O", error);
      console.error(
        `Error while cleaning up temporary directory: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "Temporary Directory Cleanup",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  } else if (resources.tempDirCleanup && resources.targetDir) {
    console.log(
      `📂 Keeping temporary directory for inspection: ${resources.targetDir}`,
    );
  }

  log("Resource cleanup completed");
}

/**
 * Formats the path suffix from a custom path
 */
function formatPathSuffix(customPath?: string): string {
  const suffix = customPath
    ? customPath.startsWith("/")
      ? customPath
      : `/${customPath}`
    : "";

  log("Formatted path suffix: %s", suffix);
  return suffix;
}

/**
 * Copy project to a temporary directory with a unique name
 */
async function copyProjectToTempDir(
  projectDir: string,
  sync: boolean = true,
): Promise<{
  tempDir: tmp.DirectoryResult;
  targetDir: string;
  workerName: string;
}> {
  log("Creating temporary directory for project");
  // Create a temporary directory
  const tempDir = await tmp.dir({ unsafeCleanup: true });

  // Generate a unique suffix for the project
  const suffix = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: "-",
    length: 2,
    style: "lowerCase",
  });

  // Create unique project directory name
  const originalDirName = basename(projectDir);
  const workerName = `${originalDirName}-smoke-test-${suffix}`;
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
      `❌ Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Try npm as fallback if pnpm fails
    try {
      console.log("⚠️ pnpm install failed, trying npm install as fallback...");

      await $({
        cwd: targetDir,
        stdio: "pipe",
      })`npm install`;

      console.log("✅ Dependencies installed successfully with npm");
    } catch (npmError) {
      log("ERROR: Both pnpm and npm install failed: %O", npmError);
      console.error(
        `❌ Failed to install dependencies with npm: ${npmError instanceof Error ? npmError.message : String(npmError)}`,
      );
      throw new Error(
        `Failed to install project dependencies. Please ensure the project can be installed with pnpm or npm.`,
      );
    }
  }
}

/**
 * Check a URL by performing smoke tests and realtime upgrade
 */
async function checkUrl(
  url: string,
  artifactDir: string,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
): Promise<void> {
  console.log(`🔍 Testing URL: ${url}`);

  log("Launching browser");
  let browser;
  try {
    browser = await launchBrowser(browserPath, headless);
  } catch (error) {
    await fail(error);
    return; // This will never be reached
  }

  // Track failures to report at the end
  let hasFailures = false;
  let initialTestError: Error | null = null;
  let realtimeTestError: Error | null = null;

  try {
    log("Opening new page");
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT);
    log("Set navigation timeout: %dms", TIMEOUT);

    // Initial smoke test
    log("Performing initial smoke test");
    let initialTestStatus = "passed";
    try {
      await checkUrlSmoke(page, url, false, bail, skipClient);
    } catch (error) {
      hasFailures = true;
      initialTestStatus = "failed";
      initialTestError =
        error instanceof Error ? error : new Error(String(error));
      log("Error during initial smoke test: %O", error);
      console.error(
        `❌ Initial smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      // If bail is true, stop the tests
      if (bail) {
        throw error;
      }

      console.log(
        "Continuing with realtime upgrade test since --bail is not enabled...",
      );
    }

    // Take a screenshot after initial test
    await takeScreenshot(
      page,
      url,
      artifactDir,
      `initial-${initialTestStatus}`,
    );

    // Upgrade to realtime and check again
    log("Upgrading to realtime");
    let realtimeTestStatus = "passed";
    try {
      await upgradeToRealtime(page);
      log("Reloading page after realtime upgrade");
      await page.reload({ waitUntil: "networkidle0" });
      log("Performing post-upgrade smoke test");
      await checkUrlSmoke(page, url, true, bail, skipClient);
    } catch (error) {
      hasFailures = true;
      realtimeTestStatus = "failed";
      realtimeTestError =
        error instanceof Error ? error : new Error(String(error));
      log("Error during realtime smoke test: %O", error);
      console.error(
        `❌ Realtime smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      // If bail is true, stop the tests
      if (bail) {
        throw error;
      }
    }

    // Take a screenshot after realtime test
    await takeScreenshot(
      page,
      url,
      artifactDir,
      `realtime-${realtimeTestStatus}`,
    );

    // If there were failures, propagate them after taking screenshots
    if (hasFailures) {
      // Combine errors or just throw the one that happened
      if (initialTestError && realtimeTestError) {
        throw new Error(
          `Multiple test failures: Initial test: ${initialTestError.message}, Realtime test: ${realtimeTestError.message}`,
        );
      } else if (initialTestError) {
        throw initialTestError;
      } else if (realtimeTestError) {
        throw realtimeTestError;
      }
    }
  } catch (error) {
    log("Error during URL check: %O", error);
    await browser
      .close()
      .catch((e: unknown) => log("Error closing browser: %O", e));
    throw error;
  } finally {
    log("Closing browser");
    await browser
      .close()
      .catch((e: unknown) => log("Error closing browser: %O", e));
  }
  log("URL check completed successfully");
}

/**
 * Helper function to take and save a screenshot with a descriptive name
 */
async function takeScreenshot(
  page: Page,
  url: string,
  artifactDir: string,
  status: string,
): Promise<void> {
  // Use the standardized screenshots directory
  const screenshotsDir = join(artifactDir, "screenshots");
  log("Saving screenshot to: %s", screenshotsDir);

  // Create a more descriptive filename with timestamp and test result
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const urlIdentifier = new URL(url).hostname.replace(/\./g, "-");
  const screenshotPath = join(
    screenshotsDir,
    `smoke-test-${urlIdentifier}-${status}-${timestamp}.png`,
  );

  log("Taking screenshot: %s", screenshotPath);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);
}

/**
 * Check smoke test status for a specific URL
 */
async function checkUrlSmoke(
  page: Page,
  url: string,
  isRealtime: boolean,
  bail: boolean = false,
  skipClient: boolean = false,
): Promise<void> {
  const phase = isRealtime ? "Post-upgrade" : "Initial";
  console.log(`🔍 Testing ${phase} smoke tests at ${url}`);

  // Parse the base URL and path to properly handle smoke test queries
  const parsedUrl = new URL(url);
  log("Parsed URL: %O", {
    origin: parsedUrl.origin,
    pathname: parsedUrl.pathname,
    search: parsedUrl.search,
  });

  // Add __smoke_test query parameter, preserving any existing query parameters
  if (parsedUrl.searchParams.has("__smoke_test")) {
    console.log(`URL already has __smoke_test parameter: ${url}`);
  } else {
    parsedUrl.searchParams.append("__smoke_test", "1");
    log("Added __smoke_test parameter to URL");
  }

  // Navigate to smoke test page
  const smokeUrl = parsedUrl.toString();
  console.log(`🔍 Accessing smoke test page: ${smokeUrl}`);
  await page.goto(smokeUrl, { waitUntil: "networkidle0" });
  log("Page loaded successfully");

  // Track failures to report at the end
  let hasFailures = false;
  let serverTestError: Error | null = null;
  let clientTestError: Error | null = null;

  // Run server-side smoke test
  log("Running server-side smoke test");
  try {
    await checkServerSmoke(page, phase);
  } catch (error) {
    hasFailures = true;
    serverTestError = error instanceof Error ? error : new Error(String(error));
    log("Error during server-side smoke test: %O", error);
    console.error(
      `❌ Server-side smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Record the specific failure
    state.failures.push({
      step: `Server-side Smoke Test (${phase})`,
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error && error.stack ? error.stack : undefined,
    });

    // If bail is true, stop the tests
    if (bail) {
      throw error;
    }

    console.log(
      "Continuing with client-side smoke test since --bail is not enabled...",
    );
  }

  // Run client-side smoke test if available and not skipped
  if (!skipClient) {
    log("Running client-side smoke test");
    try {
      await checkClientSmoke(page, phase);
    } catch (error) {
      hasFailures = true;
      clientTestError =
        error instanceof Error ? error : new Error(String(error));
      log("Error during client-side smoke test: %O", error);
      console.error(
        `❌ Client-side smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record the specific failure
      state.failures.push({
        step: `Client-side Smoke Test (${phase})`,
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });

      // If bail is true, stop the tests
      if (bail) {
        throw error;
      }
    }
  } else {
    log("Skipping client-side smoke test");
    console.log("⏩ Skipping client-side smoke test as requested");
  }

  // If there were failures, propagate them
  if (hasFailures) {
    // Combine errors or just throw the one that happened
    if (serverTestError && clientTestError) {
      throw new Error(
        `Multiple test failures: Server-side test: ${serverTestError.message}, Client-side test: ${clientTestError.message}`,
      );
    } else if (serverTestError) {
      throw serverTestError;
    } else if (clientTestError) {
      throw clientTestError;
    }
  }

  log("URL smoke test completed successfully");
}

/**
 * Check server-side smoke test status
 */
async function checkServerSmoke(
  page: Page,
  phase: string = "",
): Promise<SmokeTestResult> {
  console.log(`🔍 Testing server-side smoke test ${phase ? `(${phase})` : ""}`);

  const result = await page.evaluate(async () => {
    try {
      // Look for smoke test status indicator in the page
      const smokeElement = document.querySelector(
        '[data-testid="health-status"]',
      );
      if (!smokeElement) {
        return {
          status: "error",
          verificationPassed: false,
          error: "Smoke test status element not found in the page",
        };
      }

      // Check if required attributes exist
      const status = smokeElement.getAttribute("data-status");
      if (status === null) {
        return {
          status: "error",
          verificationPassed: false,
          error: "data-status attribute is missing on health-status element",
        };
      }

      // Check if data-verified attribute exists
      if (smokeElement.getAttribute("data-verified") === null) {
        return {
          status: "error",
          verificationPassed: false,
          error: "data-verified attribute is missing",
        };
      }

      const timestamp = parseInt(
        smokeElement.getAttribute("data-timestamp") || "0",
        10,
      );
      const serverTimestamp = parseInt(
        smokeElement.getAttribute("data-server-timestamp") || "0",
        10,
      );

      // Use the component's own verification result instead of recalculating
      const verificationPassed =
        smokeElement.getAttribute("data-verified") === "true";

      return {
        status: status || "error",
        verificationPassed: status === "ok" && verificationPassed,
        timestamp,
        serverTimestamp,
        error:
          status !== "ok" ? "Smoke test did not return ok status" : undefined,
      };
    } catch (error) {
      return {
        status: "error",
        verificationPassed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  log("Server-side smoke test result: %O", result);
  reportSmokeTestResult(result, "Server-side", phase);
  return result;
}

/**
 * Check client-side smoke test if refresh button is available
 */
async function checkClientSmoke(
  page: Page,
  phase: string = "",
): Promise<SmokeTestResult | null> {
  console.log(`🔍 Testing client-side smoke test ${phase ? `(${phase})` : ""}`);

  // Check if refresh button exists
  log("Checking for refresh button");
  const refreshButtonExists = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="refresh-health"]');
    return !!button;
  });

  if (!refreshButtonExists) {
    log("No client-side refresh button found");
    console.warn(
      "⚠️ No client-side refresh button found - this is expected only if testing a non-smoke test page",
    );

    // Look for any other evidence that the page is working
    log("Checking if page content is valid HTML");
    const pageContent = await page.content();
    if (!pageContent.includes("<!DOCTYPE html>")) {
      log("ERROR: Page doesn't appear to be a valid HTML document");
      throw new Error("Page doesn't appear to be a valid HTML document");
    }

    // Check if we're on a smoke test page - in which case missing the refresh button is a failure
    const currentUrl = page.url();
    log("Current URL: %s", currentUrl);
    if (currentUrl.includes("__smoke_test")) {
      log("ERROR: Smoke test page is missing the refresh-health button");
      throw new Error(
        "Smoke test page is missing the refresh-health button - this is a test failure",
      );
    }

    console.log(
      "ℹ️ Basic page structure verified, continuing without client-side smoke test",
    );
    return null;
  }

  log("Clicking refresh button to trigger client-side smoke test");
  await page.click('[data-testid="refresh-health"]');

  // Wait for client-side update to complete
  log("Waiting for client-side test to complete");
  try {
    await page.waitForFunction(
      () => {
        const clientIndicator = document.querySelector(
          "#smoke-test-client-timestamp",
        );
        return (
          clientIndicator &&
          +(clientIndicator.getAttribute("data-client-timestamp") ?? "0") > 0
        );
      },
      { timeout: 5000 },
    );
    log("Client-side test completed");
  } catch (error) {
    log(
      "ERROR: Timed out waiting for client-side smoke test to complete: %O",
      error,
    );
    throw new Error(
      `Timed out waiting for client-side smoke test to complete: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = await page.evaluate(async () => {
    try {
      const smokeElement = document.querySelector(
        '[data-testid="health-status"]',
      );
      if (!smokeElement) {
        return {
          status: "error",
          verificationPassed: false,
          error: "Smoke test status element not found in the page",
        };
      }

      const status = smokeElement.getAttribute("data-status");
      if (status === null) {
        return {
          status: "error",
          verificationPassed: false,
          error: "data-status attribute is missing on health-status element",
        };
      }

      // Get client timestamp from the client timestamp element
      const clientTimestampElement = document.querySelector(
        "#smoke-test-client-timestamp",
      );
      if (!clientTimestampElement) {
        return {
          status: "error",
          verificationPassed: false,
          error: "Client timestamp element not found in the page",
        };
      }

      // Check if required client attributes exist
      const clientTimestampAttr = clientTimestampElement.getAttribute(
        "data-client-timestamp",
      );
      if (clientTimestampAttr === null) {
        return {
          status: "error",
          verificationPassed: false,
          error: "data-client-timestamp attribute is missing",
        };
      }

      const clientTimestamp = parseInt(clientTimestampAttr, 10);

      // Check if status attribute exists
      const clientStatus = clientTimestampElement.getAttribute("data-status");
      if (clientStatus === null) {
        return {
          status: "error",
          verificationPassed: false,
          error: "data-status attribute is missing on client timestamp element",
        };
      }

      // Check if verified attribute exists
      if (clientTimestampElement.getAttribute("data-verified") === null) {
        return {
          status: "error",
          verificationPassed: false,
          error:
            "data-verified attribute is missing on client timestamp element",
        };
      }

      // Get client verification result directly
      const verificationPassed =
        clientTimestampElement.getAttribute("data-verified") === "true";

      return {
        status: clientStatus,
        verificationPassed: clientStatus === "ok" && verificationPassed,
        clientTimestamp,
        error:
          clientStatus !== "ok"
            ? "Client smoke test did not return ok status"
            : undefined,
      };
    } catch (error) {
      return {
        status: "error",
        verificationPassed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  log("Client-side smoke test result: %O", result);
  reportSmokeTestResult(result, "Client-side", phase);
  return result;
}

/**
 * Upgrade to realtime mode
 */
async function upgradeToRealtime(page: Page): Promise<void> {
  console.log("\n📡 Upgrading to realtime mode");
  const upgradeResult = await page.evaluate(async () => {
    try {
      // Check if __rw API exists
      if (
        typeof window.__rw !== "object" ||
        typeof window.__rw.upgradeToRealtime !== "function"
      ) {
        return {
          success: false,
          message: "The __rw API or upgradeToRealtime method is not available",
        };
      }

      await window.__rw.upgradeToRealtime();

      // If we get here, it succeeded
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  if (!upgradeResult.success) {
    log("ERROR: Failed to upgrade to realtime mode: %s", upgradeResult.message);

    // Record the specific failure
    state.failures.push({
      step: "Realtime Upgrade",
      error: upgradeResult.message ?? "Unknown error",
    });

    throw new Error(
      `Failed to upgrade to realtime mode: ${upgradeResult.message}`,
    );
  }

  console.log("✅ Successfully upgraded to realtime mode");
}

/**
 * Run the local development server and return the URL
 */
async function runDevServer(cwd?: string): Promise<{
  url: string;
  stopDev: () => Promise<void>;
}> {
  console.log("🚀 Starting development server...");

  // Function to stop the dev server - defined early so we can use it in error handling
  let devProcess: any = null;
  let isErrorExpected = false;

  const stopDev = async () => {
    isErrorExpected = true;

    if (!devProcess) {
      log("No dev process to stop");
      return;
    }

    console.log("Stopping development server...");

    try {
      // Send a regular termination signal first
      devProcess.kill();

      // Wait for the process to terminate with a timeout
      const terminationTimeout = 5000; // 5 seconds timeout
      const terminationPromise = Promise.race([
        // Wait for natural process termination
        (async () => {
          try {
            await devProcess;
            log("Dev server process was terminated normally");
            return true;
          } catch (e) {
            // Expected error when the process is killed
            log("Dev server process was terminated");
            return true;
          }
        })(),
        // Or timeout
        (async () => {
          await setTimeout(terminationTimeout);
          return false;
        })(),
      ]);

      // Check if process terminated within timeout
      const terminated = await terminationPromise;

      // If not terminated within timeout, force kill
      if (!terminated) {
        log(
          "Dev server process did not terminate within timeout, force killing with SIGKILL",
        );
        console.log(
          "⚠️ Development server not responding after 5 seconds timeout, force killing...",
        );

        // Try to kill with SIGKILL if the process still has a pid
        if (devProcess.pid) {
          try {
            // Use process.kill with SIGKILL for a stronger termination
            process.kill(devProcess.pid, "SIGKILL");
            log("Sent SIGKILL to process %d", devProcess.pid);
          } catch (killError) {
            log("Error sending SIGKILL to process: %O", killError);
            // Non-fatal, as the process might already be gone
          }
        }
      }
    } catch (e) {
      // Process might already have exited
      log("Could not kill dev server process: %O", e);
    }

    console.log("Development server stopped");
  };

  try {
    // Start dev server with stdout pipe to capture URL
    // Use the provided cwd if available
    devProcess = $({
      stdio: ["inherit", "pipe", "pipe"], // Pipe stderr again to check both streams
      detached: true,
      cleanup: false, // Don't auto-kill on exit
      cwd: cwd || process.cwd(), // Use provided directory or current directory
    })`npm run dev`;

    devProcess.catch((error: any) => {
      if (!isErrorExpected) {
        fail(error);
      }
    });

    log(
      "Development server process spawned in directory: %s",
      cwd || process.cwd(),
    );

    // Store chunks to parse the URL
    let url = "";

    // Listen for stdout to get the URL
    devProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(output);

      // Log output for debugging with explicit character representation
      log("Received stdout chunk: %O", output);
      log("Chunk as JSON: %s", JSON.stringify(output));

      // Try to extract the URL from the server output with a more flexible regex
      // Allow for variable amounts of whitespace between "Local:" and the URL
      const localMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
      if (localMatch && localMatch[1] && !url) {
        url = localMatch[1];
        log("Found development server URL: %s", url);
      } else if (
        output.includes("Local:") &&
        output.includes("http://localhost:")
      ) {
        // Log near-match for debugging
        log(
          "Found potential URL pattern but regex didn't match. Content: %s",
          output,
        );

        // Try an alternative, more general pattern
        const altMatch = output.match(/(https?:\/\/localhost:\d+)/i);
        if (altMatch && altMatch[1] && !url) {
          url = altMatch[1];
          log("Found development server URL with alternative pattern: %s", url);
        }
      }
    });

    // Also listen for stderr to check for URL patterns there as well
    devProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.error(output); // Output error messages to console

      // Log output for debugging
      log("Received stderr chunk: %O", output);
      log("Stderr chunk as JSON: %s", JSON.stringify(output));

      // Check if we already found a URL
      if (url) return;

      // Check for localhost URLs in stderr
      // Try the most general pattern - any URL with localhost
      const urlMatch = output.match(/(https?:\/\/localhost:\d+)/i);
      if (urlMatch && urlMatch[1]) {
        url = urlMatch[1];
        log("Found development server URL in stderr: %s", url);
      }
    });

    // Wait for URL with timeout
    const waitForUrl = async (): Promise<string> => {
      const start = Date.now();
      const timeout = 60000; // 60 seconds

      while (Date.now() - start < timeout) {
        if (url) {
          return url;
        }

        // Check if the process is still running
        if (devProcess.exitCode !== null) {
          log(
            "ERROR: Development server process exited with code %d",
            devProcess.exitCode,
          );
          throw new Error(
            `Development server process exited with code ${devProcess.exitCode}`,
          );
        }

        await setTimeout(500); // Check every 500ms
      }

      log("ERROR: Timed out waiting for dev server URL");
      throw new Error("Timed out waiting for dev server URL");
    };

    // Wait for the URL
    const serverUrl = await waitForUrl();
    console.log(`✅ Development server started at ${serverUrl}`);
    return { url: serverUrl, stopDev };
  } catch (error) {
    // Make sure to try to stop the server on error
    log("Error during dev server startup: %O", error);
    await stopDev().catch((e: unknown) => {
      log("Failed to stop dev server during error handling: %O", e);
    });
    throw error;
  }
}

/**
 * Ensures Cloudflare account ID is set in environment
 * Extracts from error output if available, otherwise uses RedwoodJS account
 */
async function ensureCloudflareAccountId(cwd?: string): Promise<void> {
  // Skip if already set
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    log(
      "CLOUDFLARE_ACCOUNT_ID is already set: %s",
      process.env.CLOUDFLARE_ACCOUNT_ID,
    );
    console.log(
      `Using existing CLOUDFLARE_ACCOUNT_ID: ${process.env.CLOUDFLARE_ACCOUNT_ID}`,
    );
    return;
  }

  console.log("CLOUDFLARE_ACCOUNT_ID not set, attempting to detect...");

  try {
    // Run a wrangler command that will list available accounts if there's an issue
    const result = await $({
      cwd: cwd || process.cwd(),
      stdio: "pipe",
      reject: false, // Don't throw on non-zero exit code
    })`npx wrangler whoami`;

    // If command succeeds but we still don't have an account ID, try to extract from output
    if (result.stdout) {
      // Parse output to look for account ID
      const accountIdMatch = result.stdout.match(/Account ID: ([a-f0-9]{32})/);
      if (accountIdMatch && accountIdMatch[1]) {
        const accountId = accountIdMatch[1];
        process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
        log("Extracted CLOUDFLARE_ACCOUNT_ID from whoami: %s", accountId);
        console.log(`✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
        return;
      }
    }

    // If the command ran but we couldn't find an ID or there was an error
    if (result.stderr) {
      // Look for available accounts in the error output
      const accountMatches = result.stderr.match(
        /`([^`]+)'s Account`: `([a-f0-9]{32})`/g,
      );
      if (accountMatches && accountMatches.length > 0) {
        // Extract the first account ID
        const firstAccount = accountMatches[0].match(/`([a-f0-9]{32})`$/);
        if (firstAccount && firstAccount[1]) {
          const accountId = firstAccount[1];
          process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
          log(
            "Extracted CLOUDFLARE_ACCOUNT_ID from error output: %s",
            accountId,
          );
          console.log(`✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
          return;
        }
      }
    }

    // Fall back to RedwoodJS account ID
    process.env.CLOUDFLARE_ACCOUNT_ID = REDWOODJS_ACCOUNT_ID;
    log(
      "Using default RedwoodJS CLOUDFLARE_ACCOUNT_ID: %s",
      REDWOODJS_ACCOUNT_ID,
    );
    console.log(
      `✅ Setting CLOUDFLARE_ACCOUNT_ID to RedwoodJS account: ${REDWOODJS_ACCOUNT_ID}`,
    );
  } catch (error) {
    // In case of any error, fall back to the RedwoodJS account ID
    log("Error checking Cloudflare account: %O", error);
    process.env.CLOUDFLARE_ACCOUNT_ID = REDWOODJS_ACCOUNT_ID;
    log(
      "Using default RedwoodJS CLOUDFLARE_ACCOUNT_ID due to error: %s",
      REDWOODJS_ACCOUNT_ID,
    );
    console.log(
      `⚠️ Error detecting Cloudflare account, falling back to RedwoodJS account: ${REDWOODJS_ACCOUNT_ID}`,
    );
  }
}

/**
 * Run the release process and return the deployed URL and worker name
 */
async function runRelease(
  cwd?: string,
): Promise<{ url: string; workerName: string }> {
  console.log("🚀 Running release process...");

  try {
    // Ensure CLOUDFLARE_ACCOUNT_ID is set before running release
    await ensureCloudflareAccountId(cwd);

    // Run release command with our interactive $expect utility
    log("Running release command with interactive prompts");
    const result = await $expect(
      "npm run release",
      [
        {
          // Make the pattern more flexible to account for potential whitespace differences
          expect: /Do you want to proceed with deployment\?\s*\(y\/N\)/i,
          send: "y\r",
        },
      ],
      cwd,
    );

    const stdout = result.stdout;

    // Extract deployment URL from output
    log("Extracting deployment URL from output");
    const urlMatch = stdout.match(
      /https:\/\/([a-zA-Z0-9-]+)\.redwoodjs\.workers\.dev/,
    );
    if (!urlMatch || !urlMatch[0]) {
      log("ERROR: Could not extract deployment URL from release output");
      throw new Error("Could not extract deployment URL from release output");
    }

    const url = urlMatch[0];
    const workerName = urlMatch[1];
    log("Successfully deployed to %s (worker: %s)", url, workerName);
    console.log(`✅ Successfully deployed to ${url}`);

    return { url, workerName };
  } catch (error) {
    log("ERROR: Failed to run release command: %O", error);
    throw error;
  }
}

/**
 * Launch a browser instance
 */
async function launchBrowser(
  browserPath?: string,
  headless: boolean = true,
): Promise<Browser> {
  // Get browser path if not provided
  if (!browserPath) {
    log("Getting browser executable path");
    browserPath = await getBrowserPath();
  }

  console.log(
    `🚀 Launching browser from ${browserPath} (headless: ${headless})`,
  );

  log("Starting browser with puppeteer");
  return await puppeteer.launch({
    executablePath: browserPath,
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/**
 * Get the browser executable path
 */
async function getBrowserPath(testOptions?: SmokeTestOptions): Promise<string> {
  console.log("Finding Chrome executable...");

  // First try using environment variable if set
  if (process.env.CHROME_PATH) {
    console.log(
      `Using Chrome from environment variable: ${process.env.CHROME_PATH}`,
    );
    return process.env.CHROME_PATH;
  }

  // Detect platform
  log("Detecting platform");
  const platform = detectBrowserPlatform();
  if (!platform) {
    log("ERROR: Failed to detect browser platform");
    throw new Error("Failed to detect browser platform");
  }
  log("Detected platform: %s", platform);

  // Define a consistent cache directory path in system temp folder
  const rwCacheDir = join(os.tmpdir(), "redwoodjs-smoke-test-cache");
  await mkdirp(rwCacheDir);
  log("Using cache directory: %s", rwCacheDir);

  // Determine browser type based on headless option
  const browser =
    testOptions?.headless === false
      ? PuppeteerBrowser.CHROME
      : PuppeteerBrowser.CHROMEHEADLESSSHELL;

  log(`Using browser type: ${browser}`);

  // Resolve the buildId for the stable Chrome version - do this once
  log("Resolving Chrome buildId for stable channel");
  const buildId = await resolveBuildId(browser, platform, "stable");
  log("Resolved buildId: %s", buildId);

  // Create installation options - use them consistently
  const installOptions: InstallOptions & { unpack: true } = {
    browser,
    platform,
    cacheDir: rwCacheDir,
    buildId,
    unpack: true,
  };

  try {
    // Try to compute the path first (this will check if it's installed)
    log("Attempting to find existing Chrome installation");
    const path = computeExecutablePath(installOptions);
    if (await pathExists(path)) {
      console.log(`Found existing Chrome at: ${path}`);
      return path;
    } else {
      throw new Error("Chrome not found at: " + path);
    }
  } catch (error) {
    // If path computation fails, install Chrome
    console.log("No Chrome installation found. Installing Chrome...");

    // Add better error handling for the install step
    try {
      console.log("Downloading Chrome (this may take a few minutes)...");
      await install(installOptions);
      console.log("✅ Chrome installation completed successfully");

      // Now compute the path for the installed browser
      const path = computeExecutablePath(installOptions);
      console.log(`Installed and using Chrome at: ${path}`);
      return path;
    } catch (installError) {
      // Provide more detailed error about the browser download failure
      log("ERROR: Failed to download/install Chrome: %O", installError);
      console.error(`❌ Failed to download/install Chrome browser.`);
      console.error(
        `This is likely a network issue or the browser download URL is unavailable.`,
      );
      console.error(
        `Error details: ${installError instanceof Error ? installError.message : String(installError)}`,
      );

      // For debug builds, show the full error stack if available
      if (installError instanceof Error && installError.stack) {
        log("Error stack: %s", installError.stack);
      }

      console.log("\nPossible solutions:");
      console.log("1. Check your internet connection");
      console.log(
        "2. Set CHROME_PATH environment variable to an existing Chrome installation",
      );
      console.log("3. Install Chrome manually and run the tests again");

      throw new Error(
        `Failed to install Chrome browser: ${installError instanceof Error ? installError.message : String(installError)}`,
      );
    }
  }
}

// DRY: checkServerUp now checks both root and custom path if needed
async function checkServerUp(
  baseUrl: string,
  customPath: string = "/",
  retries = RETRIES,
): Promise<boolean> {
  // Always check root first, then custom path if different
  const pathsToCheck = ["/"];
  if (customPath !== "/" && customPath !== "") {
    pathsToCheck.push(customPath);
  }

  for (const path of pathsToCheck) {
    const url = baseUrl + (path.startsWith("/") ? path : "/" + path);
    log("Checking if server is up at %s (max retries: %d)", url, retries);

    let up = false;
    for (let i = 0; i < retries; i++) {
      try {
        log("Attempt %d/%d to check server at %s", i + 1, retries, url);
        console.log(
          `Checking if server is up at ${url} (attempt ${i + 1}/${retries})...`,
        );
        await $`curl -s -o /dev/null -w "%{http_code}" ${url}`;
        log("Server is up at %s", url);
        console.log(`✅ Server is up at ${url}`);
        up = true;
        break;
      } catch (error) {
        if (i === retries - 1) {
          log(
            "ERROR: Server at %s did not become available after %d attempts",
            url,
            retries,
          );

          // Record the specific failure
          state.failures.push({
            step: `Server Availability Check: ${url}`,
            error: `Server at ${url} did not become available after ${retries} attempts`,
          });

          await fail(
            new Error(
              `Server at ${url} did not become available after ${retries} attempts`,
            ),
            1,
            `Server Availability Check: ${url}`,
          );
          return false; // This will never be reached
        }
        log("Server not up yet, retrying in 2 seconds");
        console.log(`Server not up yet, retrying in 2 seconds...`);
        await setTimeout(2000);
      }
    }
    if (!up) return false;
  }
  return true;
}

/**
 * Report the smoke test result
 */
function reportSmokeTestResult(
  result: SmokeTestResult,
  type: string,
  phase: string = "",
): void {
  const phasePrefix = phase ? `(${phase}) ` : "";
  log("Reporting %s%s smoke test result: %O", phasePrefix, type, result);

  if (result.verificationPassed) {
    console.log(`✅ ${phasePrefix}${type} smoke test passed!`);
    if (result.serverTimestamp) {
      console.log(`✅ Server timestamp: ${result.serverTimestamp}`);
    }
    if (result.clientTimestamp) {
      console.log(`✅ Client timestamp: ${result.clientTimestamp}`);
    }
  } else {
    log(
      "ERROR: %s%s smoke test failed. Status: %s. Error: %s",
      phasePrefix,
      type,
      result.status,
      result.error || "unknown",
    );
    throw new Error(
      `${phasePrefix}${type} smoke test failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`,
    );
  }
}

/**
 * Delete the worker using wrangler
 */
async function deleteWorker(name: string, cwd?: string): Promise<void> {
  console.log(`Cleaning up: Deleting worker ${name}...`);
  try {
    // Use our $expect utility to handle any confirmation prompts
    log("Running wrangler delete command with interactive prompts");
    await $expect(
      `npx wrangler delete ${name}`,
      [
        {
          expect: "Are you sure you want to delete",
          send: "y\r",
        },
      ],
      cwd,
    );
    console.log(`✅ Worker ${name} deleted successfully`);
  } catch (error) {
    console.error(`Failed to delete worker ${name}: ${error}`);
    // Retry with force flag if the first attempt failed
    try {
      console.log("Retrying with force flag...");
      await $expect(
        `npx wrangler delete ${name} --yes --force`,
        [
          {
            expect: "Are you sure you want to delete",
            send: "y\r",
          },
        ],
        cwd,
      );
      console.log(`✅ Worker ${name} force deleted successfully`);
    } catch (retryError) {
      console.error(`Failed to force delete worker ${name}: ${retryError}`);
    }
  }
}

/**
 * Creates the smoke test components in the target project directory
 */
async function createSmokeTestComponents(
  targetDir: string,
  skipClient: boolean = false,
): Promise<void> {
  console.log("Creating smoke test components in project...");

  // Create directories if they don't exist
  const componentsDir = join(targetDir, "src", "app", "components");
  log("Creating components directory: %s", componentsDir);
  await fs.mkdir(componentsDir, { recursive: true });

  // Create __smokeTestFunctions.ts
  const smokeTestFunctionsPath = join(componentsDir, "__smokeTestFunctions.ts");
  log("Creating __smokeTestFunctions.ts at: %s", smokeTestFunctionsPath);
  const smokeTestFunctionsContent = `"use server";

export async function smokeTestAction(
  timestamp?: number,
): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { status: "ok", timestamp };
}
`;

  // Create SmokeTest.tsx with conditional client component import
  const smokeTestPath = join(componentsDir, "__SmokeTest.tsx");
  log("Creating __SmokeTest.tsx at: %s", smokeTestPath);
  const smokeTestContent = `
import React from "react";
import { RequestInfo } from "rwsdk/worker";
${skipClient ? "" : 'import { SmokeTestClient } from "./__SmokeTestClient";'}
import { smokeTestAction } from "./__smokeTestFunctions";

export const SmokeTestInfo: React.FC = async () => {
  const timestamp = Date.now();
  let status = "error";
  let verificationPassed = false;
  let result: any = null;

  try {
    result = await smokeTestAction(timestamp);
    status = result.status || "error";
    verificationPassed = result.timestamp === timestamp;
  } catch (error) {
    console.error("Smoke test failed:", error);
    status = "error";
    result = { error: error instanceof Error ? error.message : String(error) };
  }

  return (
    <div
      id="smoke-test-container"
      data-testid="health-status"
      data-status={status}
      data-timestamp={timestamp}
      data-server-timestamp={Date.now()}
      data-verified={verificationPassed ? "true" : "false"}
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        margin: "20px",
        padding: "15px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        background: "#f9f9f9",
      }}
    >
      <h2
        style={{
          color: status === "ok" ? "#0c9" : "#f44",
          margin: "0 0 10px 0",
        }}
      >
        Smoke Test: {status}
      </h2>
      <div
        id="smoke-test-result"
      >
        {verificationPassed
          ? "Timestamp verification passed ✅"
          : "Timestamp verification failed ⚠️"}
      </div>
      <details style={{ marginTop: "10px" }}>
        <summary>Details</summary>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "10px",
            borderRadius: "4px",
            fontSize: "12px",
            overflow: "auto",
          }}
        >
          {JSON.stringify({ timestamp, result, verificationPassed }, null, 2)}
        </pre>
      </details>

      ${
        skipClient
          ? "<!-- Client-side checks disabled -->"
          : "{/* Include the client component for on-demand smoke tests */}\n      <SmokeTestClient />"
      }
    </div>
  );
};`;

  // Write the server files
  log("Writing SmokeTestFunctions file");
  await fs.writeFile(smokeTestFunctionsPath, smokeTestFunctionsContent);
  log("Writing SmokeTest component file");
  await fs.writeFile(smokeTestPath, smokeTestContent);

  // Only create client component if not skipping client-side tests
  if (!skipClient) {
    // Create SmokeTestClient.tsx
    const smokeTestClientPath = join(componentsDir, "__SmokeTestClient.tsx");
    log("Creating __SmokeTestClient.tsx at: %s", smokeTestClientPath);
    const smokeTestClientContent = `"use client";

import React, { useState } from "react";
import { smokeTestAction } from "./__smokeTestFunctions";

interface SmokeTestStatus {
  status: string;
  verificationPassed: boolean;
  timestamp: number;
  rawResult?: unknown;
  error?: string;
}

interface SmokeTestResponse {
  status: string;
  timestamp?: number;
  [key: string]: unknown;
}

export const SmokeTestClient: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<SmokeTestStatus | null>(null);

  const runSmokeTest = async () => {
    setLoading(true);
    const timestamp = Date.now();

    try {
      // Get current timestamp to verify round-trip
      const result = await smokeTestAction(timestamp);
      const status = result.status || "error";
      const verificationPassed = result.timestamp === timestamp;

      setLastCheck({
        status,
        verificationPassed,
        timestamp,
        rawResult: result,
      });
    } catch (error) {
      setLastCheck({
        status: "error",
        verificationPassed: false,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="smoke-test-client"
      style={{
        margin: "20px 0",
        padding: "15px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        background: "#f9f9f9",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h3>Manual Smoke Test</h3>
      <button
        data-testid="refresh-health"
        onClick={runSmokeTest}
        disabled={loading}
        style={{
          padding: "8px 16px",
          background: loading ? "#ccc" : "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: "bold",
        }}
      >
        {loading ? "Checking..." : "Run Smoke Test"}
      </button>

      {lastCheck && (
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: lastCheck.status === "ok" ? "#e6f7ee" : "#ffeded",
              border: \`1px solid \${
                lastCheck.status === "ok" ? "#0c9" : "#f44"
              }\`,
            }}
          >
            <h4
              style={{
                margin: "0 0 10px 0",
                color: lastCheck.status === "ok" ? "#0c9" : "#f44",
              }}
            >
              Status: {lastCheck.status}
            </h4>
            <p>
              Timestamp verification:{" "}
              {lastCheck.verificationPassed ? "Passed ✅" : "Failed ⚠️"}
            </p>
            {lastCheck.error && (
              <p style={{ color: "#f44" }}>Error: {lastCheck.error}</p>
            )}
            <details style={{ marginTop: "10px" }}>
              <summary>Raw Result</summary>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "10px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(
                  {
                    timestamp: lastCheck.timestamp,
                    result: lastCheck.rawResult,
                    verificationPassed: lastCheck.verificationPassed,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </div>
      )}

      <div 
        id="smoke-test-client-timestamp"
        data-client-timestamp={lastCheck?.timestamp ?? ""}
        data-status={lastCheck?.status ?? ""}
        data-verified={lastCheck?.verificationPassed ? "true" : "false"}
        style={{ display: "none" }}
      />
    </div>
  );
};`;

    log("Writing SmokeTestClient component file");
    await fs.writeFile(smokeTestClientPath, smokeTestClientContent);
    log("Created client-side smoke test component");
  } else {
    log("Skipping client-side smoke test component creation");
  }

  log("Smoke test components created successfully");
  console.log("Created smoke test components:");
  console.log(`- ${smokeTestFunctionsPath}`);
  console.log(`- ${smokeTestPath}`);
  if (!skipClient) {
    console.log(`- ${join(componentsDir, "__SmokeTestClient.tsx")}`);
  } else {
    console.log("- Client component skipped (--skip-client was specified)");
  }
}

// Run the smoke test if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  log("Command line arguments: %O", args);

  // Check for CI flag first
  const ciFlag = args.includes("--ci");

  // Set initial default values (sync will be determined below)
  const options: SmokeTestOptions = {
    customPath: "/", // Default path
    skipDev: false,
    skipRelease: false,
    skipClient: false,
    projectDir: undefined,
    artifactDir: join(process.cwd(), ".artifacts"), // Default to .artifacts in current directory
    keep: isRunningInCI(ciFlag), // Default to true in CI environments
    headless: true,
    ci: ciFlag,
    bail: false, // Default to false - continue tests even if some fail
    // sync: will be set below
  };

  // Log if we're in CI
  if (isRunningInCI(ciFlag)) {
    log("Running in CI environment, keeping test directory by default");
  }

  // Track if user explicitly set sync or no-sync
  let syncExplicit: boolean | undefined = undefined;

  // Process arguments in order
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--skip-dev") {
      options.skipDev = true;
    } else if (arg === "--skip-release") {
      options.skipRelease = true;
    } else if (arg === "--skip-client") {
      options.skipClient = true;
    } else if (arg === "--keep") {
      options.keep = true;
    } else if (arg === "--no-headless") {
      options.headless = false;
    } else if (arg === "--no-sync") {
      syncExplicit = false;
    } else if (arg === "--sync") {
      syncExplicit = true;
    } else if (arg === "--ci") {
      // Already handled above, just skip
    } else if (arg === "--bail") {
      options.bail = true;
    } else if (arg === "--help" || arg === "-h") {
      // Help will be handled later
    } else if (arg.startsWith("--path=")) {
      options.projectDir = arg.substring(7);
    } else if (arg.startsWith("--artifact-dir=")) {
      options.artifactDir = arg.substring(15);
    } else if (arg.startsWith("--url=")) {
      options.customPath = arg.substring(6);
    } else if (!arg.startsWith("--")) {
      // For backwards compatibility, any non-flag argument is treated as the custom path
      console.log(
        `Setting URL path to "${arg}" (use --url= format in the future)`,
      );
      options.customPath = arg;
    } else {
      // Throw error for unknown options instead of just warning
      log("Unknown option: %s", arg);
      throw new Error(
        `Unknown option: ${arg}. Use --help to see available options.`,
      );
    }
  }

  // Async IIFE to determine sync default and run main
  (async () => {
    if (syncExplicit !== undefined) {
      options.sync = syncExplicit;
    } else {
      // Determine default for sync: true if cwd has package.json with name 'rwsdk', otherwise false
      let syncDefault = false;
      const pkgPath = join(process.cwd(), "package.json");
      log(`[sync default] Checking for package.json at: %s`, pkgPath);
      try {
        const pkgRaw = await fs.readFile(pkgPath, "utf8");
        log(`[sync default] Read package.json: %s`, pkgRaw);
        const pkg = JSON.parse(pkgRaw);
        if (pkg && pkg.name === "rwsdk") {
          log(
            `[sync default] package.json name is 'rwsdk', setting syncDefault = true`,
          );
          syncDefault = true;
        } else {
          log(
            `[sync default] package.json name is not 'rwsdk', setting syncDefault = false`,
          );
        }
      } catch (e) {
        log(`[sync default] Could not read package.json or parse name: %O`, e);
        log(`[sync default] Defaulting syncDefault = false`);
      }
      log(`[sync default] Final syncDefault value: %s`, syncDefault);
      options.sync = syncDefault;
    }

    log("Parsed options: %O", options);

    // Print help if requested
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
Smoke Test Usage:
  node smoke-test.mjs [options]

Options:
  --url=PATH              Custom URL path to test (e.g., "/login")
  --skip-dev              Skip testing the local development server
  --skip-release          Skip testing the release/production deployment
  --skip-client           Skip client-side tests, only run server-side checks
  --path=PATH             Project directory to test
  --artifact-dir=DIR      Directory to store test artifacts (default: .artifacts)
                          Creates structured output with subdirectories:
                            - screenshots/: Browser screenshots
                            - projects/: Test project copies
                            - reports/: Test result reports
  --keep                  Don't delete the temporary project directory after tests
                          (Defaults to true when running in CI environments)
  --no-headless           Use regular browser instead of headless browser for testing
  --no-sync               Do not sync SDK before running smoke test (overrides default)
  --sync                  Force sync SDK before running smoke test (overrides default)
  --ci                    Force CI mode behavior (keeps temporary directories by default)
  --bail                  Stop on first test failure (default: run all possible tests)
  --help, -h              Show this help message

CI Environment:
  * When running in CI (detected automatically or with --ci flag), the --keep flag defaults to true
  * Screenshots and test reports are always saved to the artifacts directory
  * Test project is copied to the artifacts directory when --keep is true

Examples:
  pnpm smoke-test                                # Test both dev and release with default path (/)
  pnpm smoke-test --url=/login                   # Test both dev and release with /login path
  pnpm smoke-test --skip-release                 # Only test dev server
  pnpm smoke-test --path=./my-project            # Test using the specified project directory
  pnpm smoke-test --path=./my-project --keep     # Keep the test directory after completion
  pnpm smoke-test --no-headless                  # Use headed browser for visual debugging
  pnpm smoke-test --artifact-dir=my-artifacts    # Use custom artifacts directory
  pnpm smoke-test --ci                           # Force CI mode behavior
  pnpm smoke-test --bail                         # Stop on first test failure
`);
      // No error, just showing help
      log("Exiting after showing help");
      process.exit(0);
    }

    try {
      // Store options in the module-level state
      state.options = options;

      // Run the main function
      log("Starting smoke test");
      await main(options);
      // On success, teardown() is called inside main()
    } catch (error) {
      // If an uncaught error happens, make sure we attempt teardown
      await fail(error);
    }
  })();
}

/**
 * A mini expect-like utility for handling interactive CLI prompts and verifying output
 * @param command The command to execute
 * @param expectations Array of {expect, send} objects for interactive responses and verification
 * @param cwd Working directory for command execution
 * @returns Promise that resolves when the command completes
 */
export async function $expect(
  command: string,
  expectations: Array<{ expect: string | RegExp; send?: string }>,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    log("$expect starting with command: %s", command);
    log("Working directory: %s", cwd ?? process.cwd());
    log(
      "Expected patterns: %O",
      expectations.map((e) => e.expect.toString()),
    );

    console.log(`Running command: ${command}`);

    // Spawn the process with pipes for interaction
    const childProcess = execaCommand(command, {
      cwd: cwd ?? process.cwd(),
      stdio: "pipe",
    });

    log("Process spawned with PID: %s", childProcess.pid);

    let stdout = "";
    let stderr = "";
    let buffer = "";
    let lastMatchIndex = 0; // Track the index where the last match occurred

    // Track patterns that have been matched
    const matchHistory = new Map<string | RegExp, number>();
    // Track current expectation index to process them in order
    let currentExpectationIndex = 0;

    // Initialize match count for each pattern
    expectations.forEach(({ expect: expectPattern }) => {
      matchHistory.set(expectPattern, 0);
      log("Initialized pattern match count for: %s", expectPattern.toString());
    });

    // Collect stdout
    childProcess.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      buffer += chunk;

      log("Received stdout chunk (%d bytes): %s", chunk.length, chunk.trim());

      // Print to console
      process.stdout.write(chunk);

      // Only process expectations that haven't been fully matched yet
      // and in the order they were provided
      while (currentExpectationIndex < expectations.length) {
        const { expect: expectPattern, send } =
          expectations[currentExpectationIndex];
        const pattern =
          expectPattern instanceof RegExp
            ? expectPattern
            : new RegExp(expectPattern, "m");

        // Only search in the unmatched portion of the buffer
        const searchBuffer = buffer.substring(lastMatchIndex);

        log(
          "Testing pattern: %s against buffer from position %d (%d chars)",
          pattern.toString(),
          lastMatchIndex,
          searchBuffer.length,
        );

        // Enhanced debugging: show actual search buffer content
        log("Search buffer content for debugging: %O", searchBuffer);

        const match = searchBuffer.match(pattern);
        if (match) {
          // Found a match
          const patternStr = expectPattern.toString();
          const matchCount = matchHistory.get(expectPattern) || 0;

          // Update the lastMatchIndex to point after this match
          // Calculate the absolute position in the full buffer
          const matchStartPosition = lastMatchIndex + match.index!;
          const matchEndPosition = matchStartPosition + match[0].length;
          lastMatchIndex = matchEndPosition;

          log(
            `Pattern matched: "${patternStr}" (occurrence #${matchCount + 1}) at position ${matchStartPosition}-${matchEndPosition}`,
          );

          // Only send a response if one is specified
          if (send) {
            log(`Sending response: "${send.replace(/\r/g, "\\r")}" to stdin`);
            childProcess.stdin?.write(send);
          } else {
            log(`Pattern "${patternStr}" matched (verification only)`);
          }

          // Increment the match count for this pattern
          matchHistory.set(expectPattern, matchCount + 1);
          log("Updated match count for %s: %d", patternStr, matchCount + 1);

          // Move to the next expectation
          currentExpectationIndex++;
          // If we've processed all expectations but need to wait for stdin response,
          // delay closing stdin until the next data event
          if (currentExpectationIndex >= expectations.length && send) {
            log("All patterns matched, closing stdin after last response");
            childProcess.stdin?.end();
          }

          break; // Exit the while loop to process next chunk
        } else {
          log("Pattern not matched. Attempting to diagnose the mismatch:");

          // Try to find the closest substring that might partially match
          const patternString = pattern.toString();
          const patternCore = patternString.substring(
            1,
            patternString.lastIndexOf("/") > 0
              ? patternString.lastIndexOf("/")
              : patternString.length,
          );

          // Try partial matches to diagnose the issue
          for (let i = 3; i < patternCore.length; i++) {
            const partialPattern = patternCore.substring(0, i);
            const partialRegex = new RegExp(partialPattern, "m");
            const matches = partialRegex.test(searchBuffer);
            log(
              "  Partial pattern '%s': %s",
              partialPattern,
              matches ? "matched" : "not matched",
            );

            // Once we find where the matching starts to fail, stop
            if (!matches) break;
          }

          // Break the while loop as this pattern doesn't match yet
          break;
        }
      }

      // If all expectations have been matched, we can close stdin if not already closed
      if (
        currentExpectationIndex >= expectations.length &&
        childProcess.stdin?.writable
      ) {
        log("All patterns matched, ensuring stdin is closed");
        childProcess.stdin.end();
      }
    });

    // Collect stderr if needed
    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        log("Received stderr chunk (%d bytes): %s", chunk.length, chunk.trim());
        // Also write stderr to console
        process.stderr.write(chunk);
      });
    }

    // Handle process completion
    childProcess.on("close", (code) => {
      log("Process closed with code: %s", code);

      // Log the number of matches for each pattern
      log("Pattern match summary:");
      for (const [pattern, count] of matchHistory.entries()) {
        log(`  - "${pattern.toString()}": ${count} matches`);
      }

      // Check if any required patterns were not matched
      const unmatchedPatterns = Array.from(matchHistory.entries())
        .filter(([_, count]) => count === 0)
        .map(([pattern, _]) => pattern.toString());

      if (unmatchedPatterns.length > 0) {
        log(
          "WARNING: Some expected patterns were not matched: %O",
          unmatchedPatterns,
        );
      }

      log(
        "$expect completed. Total stdout: %d bytes, stderr: %d bytes",
        stdout.length,
        stderr.length,
      );

      resolve({ stdout, stderr, code });
    });

    childProcess.on("error", (err) => {
      log("Process error: %O", err);
      reject(new Error(`Failed to execute command: ${err.message}`));
    });
  });
}

export { main, checkUrl, checkUrlSmoke, checkServerSmoke, checkClientSmoke };
