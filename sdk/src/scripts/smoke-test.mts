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
import { spawn } from "child_process";
import { copy, mkdirp, pathExists } from "fs-extra";
import tmp from "tmp-promise";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import ignore from "ignore";
import debug from "debug";

// Initialize the debug logger
const log = debug("rwsdk:smoke");

const TIMEOUT = 30000; // 30 seconds timeout
const RETRIES = 3;

interface SmokeTestResult {
  status: string;
  verificationPassed: boolean;
  timestamp?: number;
  rawResult?: unknown;
  error?: string;
  serverTimestamp?: number;
  clientTimestamp?: number;
}

// Define the expected smoke test response type
interface SmokeTestResponse {
  status: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface SmokeTestOptions {
  customPath?: string;
  skipDev?: boolean;
  skipRelease?: boolean;
  projectDir?: string;
  artifactDir?: string;
  keep?: boolean;
}

/**
 * Main function that orchestrates the smoke test flow
 */
async function main(options: SmokeTestOptions = {}) {
  log("Starting smoke test with options: %O", options);

  // Throw immediately if both tests would be skipped
  if (options.skipDev && options.skipRelease) {
    log("Error: Both dev and release tests are skipped");
    throw new Error(
      "Cannot skip both dev and release tests. At least one must run.",
    );
  }

  // Prepare browser early to avoid waiting later
  log("Preparing browser early");
  console.log("🔍 Preparing browser for testing...");
  const browserPath = await getBrowserPath();
  log("Browser ready at: %s", browserPath);
  console.log(`✅ Browser ready at: ${browserPath}`);

  log("Setting up test environment");
  const resources = await setupTestEnvironment(options);

  try {
    // Run the tests that weren't skipped
    if (!options.skipDev) {
      log("Starting development server");
      // Start the dev server first, store the stop function in resources
      const { url, stopDev } = await runDevServer(resources.targetDir);
      resources.stopDev = stopDev;

      log("Running development server tests");
      await runDevTest(
        url,
        options.customPath,
        options.artifactDir,
        browserPath,
      );
    } else {
      log("Skipping development server tests");
    }

    if (!options.skipRelease) {
      log("Running release/production tests");
      await runReleaseTest(
        options.customPath,
        resources,
        options.artifactDir,
        browserPath,
      );
    } else {
      log("Skipping release/production tests");
    }

    log("All smoke tests completed successfully");
    console.log("\n✅ All smoke tests passed!");
  } finally {
    log("Cleaning up resources");
    await cleanupResources(resources, options);
  }
}

/**
 * Sets up the test environment, preparing any resources needed for testing
 */
async function setupTestEnvironment(options: {
  customPath?: string;
  skipDev?: boolean;
  skipRelease?: boolean;
  projectDir?: string;
  artifactDir?: string;
}): Promise<{
  tempDirCleanup?: () => Promise<void>;
  workerName?: string;
  originalCwd: string;
  targetDir?: string;
  workerCreatedDuringTest?: boolean;
  stopDev?: () => Promise<void>;
}> {
  log("Setting up test environment with options: %O", options);

  const resources: {
    tempDirCleanup?: () => Promise<void>;
    workerName?: string;
    originalCwd: string;
    targetDir?: string;
    workerCreatedDuringTest?: boolean;
    stopDev?: () => Promise<void>;
  } = {
    tempDirCleanup: undefined,
    workerName: undefined,
    originalCwd: process.cwd(),
    targetDir: undefined,
    workerCreatedDuringTest: false,
    stopDev: undefined,
  };

  log("Current working directory: %s", resources.originalCwd);

  // If a project dir is specified, copy it to a temp dir with a unique name
  if (options.projectDir) {
    log("Project directory specified: %s", options.projectDir);
    const { tempDir, targetDir, workerName } = await copyProjectToTempDir(
      options.projectDir,
    );

    // Store cleanup function
    resources.tempDirCleanup = tempDir.cleanup;
    resources.workerName = workerName;
    resources.targetDir = targetDir;

    log("Target directory: %s", targetDir);

    // Create the smoke test components in the user's project
    log("Creating smoke test components");
    await createSmokeTestComponents(targetDir);
  } else {
    log("No project directory specified, using current directory");
    // When no project dir is specified, we'll use the current directory
    resources.targetDir = resources.originalCwd;
  }

  return resources;
}

/**
 * Runs tests against the development server
 */
async function runDevTest(
  url: string,
  customPath?: string,
  artifactDir?: string,
  browserPath?: string,
): Promise<void> {
  log("Starting dev server test with path: %s", customPath || "default");
  console.log("🚀 Testing local development server");
  const pathSuffix = formatPathSuffix(customPath);
  log("Path suffix: %s", pathSuffix);

  log("Testing URL: %s", url + pathSuffix);
  await checkUrl(url + pathSuffix, artifactDir, browserPath);
  log("Development server test completed successfully");
}

/**
 * Runs tests against the production deployment
 */
async function runReleaseTest(
  customPath?: string,
  resources?: {
    workerName?: string;
    targetDir?: string;
    workerCreatedDuringTest?: boolean;
  },
  artifactDir?: string,
  browserPath?: string,
): Promise<void> {
  log("Starting release test with path: %s", customPath || "default");
  console.log("\n🚀 Testing production deployment");
  const pathSuffix = formatPathSuffix(customPath);
  log("Path suffix: %s", pathSuffix);

  log("Running release process");
  const { url, workerName } = await runRelease(resources?.targetDir);
  log("Testing URL: %s with worker: %s", url + pathSuffix, workerName);
  await checkUrl(url + pathSuffix, artifactDir, browserPath);
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
  }
}

/**
 * Cleans up any resources used during testing
 */
async function cleanupResources(
  resources: {
    tempDirCleanup?: () => Promise<void>;
    workerName?: string;
    originalCwd: string;
    targetDir?: string;
    workerCreatedDuringTest?: boolean;
    stopDev?: () => Promise<void>;
  },
  options: SmokeTestOptions,
): Promise<void> {
  log("Cleaning up resources");

  // Stop dev server if it was started
  if (resources.stopDev) {
    log("Stopping development server");
    console.log("Stopping development server...");
    await resources.stopDev();
  }

  // Clean up resources
  if (resources.workerName && resources.workerCreatedDuringTest) {
    log("Deleting worker: %s", resources.workerName);
    console.log(`🧹 Cleaning up: Deleting worker ${resources.workerName}...`);
    await deleteWorker(resources.workerName, resources.targetDir);
  } else if (resources.workerName) {
    log(
      "Not deleting worker %s as it was not created during this test",
      resources.workerName,
    );
  }

  if (resources.tempDirCleanup && !options.keep) {
    log("Cleaning up temporary directory");
    await resources.tempDirCleanup();
    log("Temporary directory cleaned up");
  } else if (resources.tempDirCleanup && options.keep && resources.targetDir) {
    log("Keeping temporary directory for inspection: %s", resources.targetDir);
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
async function copyProjectToTempDir(projectDir: string): Promise<{
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
  const workerName = `${originalDirName}_${suffix}`;
  const targetDir = resolve(tempDir.path, workerName);

  log("Copying project from %s to %s", projectDir, targetDir);
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

  return { tempDir, targetDir, workerName };
}

/**
 * Install project dependencies using pnpm
 */
async function installDependencies(targetDir: string): Promise<void> {
  log("Installing dependencies in %s", targetDir);
  console.log(`📦 Installing project dependencies in ${targetDir}...`);

  try {
    // Run pnpm install in the target directory
    log("Running pnpm install");
    const result = await $({
      cwd: targetDir,
      stdio: "pipe", // Capture output
    })`pnpm install`;

    log("pnpm install completed successfully");
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
      log("Attempting fallback to npm install");
      console.log("⚠️ pnpm install failed, trying npm install as fallback...");

      await $({
        cwd: targetDir,
        stdio: "pipe",
      })`npm install`;

      log("npm install completed successfully");
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
  artifactDir?: string,
  browserPath?: string,
): Promise<void> {
  log("Checking URL: %s", url);
  console.log(`🔍 Testing URL: ${url}`);

  log("Launching browser");
  const browser = await launchBrowser(browserPath);

  try {
    log("Opening new page");
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT);
    log("Set navigation timeout: %dms", TIMEOUT);

    // Initial smoke test
    log("Performing initial smoke test");
    await checkUrlSmoke(page, url, false);

    // Upgrade to realtime and check again
    log("Upgrading to realtime");
    await upgradeToRealtime(page);
    log("Reloading page after realtime upgrade");
    await page.reload({ waitUntil: "networkidle0" });
    log("Performing post-upgrade smoke test");
    await checkUrlSmoke(page, url, true);

    // Take a screenshot for CI artifacts if needed
    const screenshotPath = artifactDir
      ? `${artifactDir}/smoke-test-result.png`
      : "smoke-test-result.png";

    // Ensure the artifact directory exists
    if (artifactDir) {
      log("Creating artifact directory: %s", artifactDir);
      await fs.mkdir(artifactDir, { recursive: true });
    }

    log("Taking screenshot: %s", screenshotPath);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved to ${screenshotPath}`);
  } finally {
    log("Closing browser");
    await browser.close();
  }
  log("URL check completed successfully");
}

/**
 * Check smoke test status for a specific URL
 */
async function checkUrlSmoke(
  page: Page,
  url: string,
  isRealtime: boolean,
): Promise<void> {
  const phase = isRealtime ? "Post-upgrade" : "Initial";
  log("Testing %s smoke tests at %s", phase, url);
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
    log("URL already has __smoke_test parameter: %s", url);
    console.log(`URL already has __smoke_test parameter: ${url}`);
  } else {
    parsedUrl.searchParams.append("__smoke_test", "1");
    log("Added __smoke_test parameter to URL");
  }

  // Navigate to smoke test page
  const smokeUrl = parsedUrl.toString();
  log("Accessing smoke test page: %s", smokeUrl);
  console.log(`🔍 Accessing smoke test page: ${smokeUrl}`);
  await page.goto(smokeUrl, { waitUntil: "networkidle0" });
  log("Page loaded successfully");

  // Run server-side smoke test
  log("Running server-side smoke test");
  await checkServerSmoke(page, phase);

  // Run client-side smoke test if available
  log("Running client-side smoke test");
  await checkClientSmoke(page, phase);

  log("URL smoke test completed successfully");
}

/**
 * Check server-side smoke test status
 */
async function checkServerSmoke(
  page: Page,
  phase: string = "",
): Promise<SmokeTestResult> {
  log("Testing server-side smoke test %s", phase ? `(${phase})` : "");
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

      const status = smokeElement.getAttribute("data-status");
      const timestamp = parseInt(
        smokeElement.getAttribute("data-timestamp") || "0",
        10,
      );
      const serverTimestamp = parseInt(
        smokeElement.getAttribute("data-server-timestamp") || "0",
        10,
      );

      // Verify timestamps are reasonable (within 60 seconds of now)
      const now = Date.now();
      const isTimestampRecent = Math.abs(now - timestamp) < 60000;
      const isServerTimestampRecent = Math.abs(now - serverTimestamp) < 60000;

      return {
        status: status || "error",
        verificationPassed:
          status === "ok" && isTimestampRecent && isServerTimestampRecent,
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
  log("Testing client-side smoke test %s", phase ? `(${phase})` : "");
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

    log(
      "Basic page structure verified, continuing without client-side smoke test",
    );
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
        const indicator = document.querySelector(
          '[data-testid="health-status"]',
        );
        return (
          indicator && indicator.getAttribute("data-client-timestamp") !== null
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
      const clientTimestamp = parseInt(
        smokeElement.getAttribute("data-client-timestamp") || "0",
        10,
      );

      // Verify timestamp is reasonable (within 60 seconds of now)
      const now = Date.now();
      const isClientTimestampRecent = Math.abs(now - clientTimestamp) < 60000;

      return {
        status: status || "error",
        verificationPassed: status === "ok" && isClientTimestampRecent,
        clientTimestamp,
        error:
          status !== "ok"
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
  log("Upgrading to realtime mode");
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
    throw new Error(
      `Failed to upgrade to realtime mode: ${upgradeResult.message}`,
    );
  }

  log("Successfully upgraded to realtime mode");
  console.log("✅ Successfully upgraded to realtime mode");
}

/**
 * Run the local development server and return the URL
 */
async function runDevServer(cwd?: string): Promise<{
  url: string;
  stopDev: () => Promise<void>;
}> {
  log("Starting development server");
  console.log("🚀 Starting development server...");

  // Start dev server with stdout pipe to capture URL
  // Use the provided cwd if available
  const devProcess = $({
    stdio: ["inherit", "pipe", "inherit"],
    detached: true,
    cleanup: false, // Don't auto-kill on exit
    cwd: cwd || process.cwd(), // Use provided directory or current directory
  })`npm run dev`;

  log(
    "Development server process spawned in directory: %s",
    cwd || process.cwd(),
  );

  // Store chunks to parse the URL
  let url = "";

  // Listen for stdout to get the URL
  devProcess.stdout?.on("data", (data) => {
    const output = data.toString();
    console.log(output);

    // Try to extract the URL from the server output
    const localMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
    if (localMatch && localMatch[1] && !url) {
      url = localMatch[1];
      log("Found development server URL: %s", url);
    }
  });

  // Function to stop the dev server
  const stopDev = async () => {
    log("Stopping development server");
    console.log("Stopping development server...");

    devProcess.kill();

    try {
      await devProcess;
    } catch (e) {
      // Expected error when the process is killed
      log("Dev server process was terminated");
    }

    log("Development server stopped");
    console.log("Development server stopped");
  };

  // Wait for URL with timeout
  const waitForUrl = async (): Promise<string> => {
    const start = Date.now();
    const timeout = 60000; // 60 seconds

    while (Date.now() - start < timeout) {
      if (url) {
        return url;
      }
      await setTimeout(500); // Check every 500ms
    }

    log("ERROR: Timed out waiting for dev server URL");
    throw new Error("Timed out waiting for dev server URL");
  };

  // Wait for the URL
  const serverUrl = await waitForUrl();

  log("Development server started at %s", serverUrl);
  console.log(`✅ Development server started at ${serverUrl}`);
  return { url: serverUrl, stopDev };
}

/**
 * Run the release process and return the deployed URL and worker name
 */
async function runRelease(
  cwd?: string,
): Promise<{ url: string; workerName: string }> {
  log("Running release process");
  console.log("🚀 Running release process...");

  // Create an interactive expect script for handling the release prompts
  const expectScript = `#!/usr/bin/env expect -f
spawn npm run release
expect {
  "Do you want to proceed with deployment? (y/N)" {
    send "y\\r"
    exp_continue
  }
  "Select an account" {
    send "\\r"
    exp_continue
  }
  "wrangler" {
    # Just wait for wrangler output
    exp_continue
  }
  "https://" {
    # Deployment URL appears
  }
}
# Wait for process to complete
wait
`;

  log("Creating temporary expect script file");
  // Create a temporary file for the expect script
  const tempExpectFile = await tmp.file({ postfix: ".exp" });
  const scriptPath = tempExpectFile.path;

  await fs.writeFile(scriptPath, expectScript);
  await fs.chmod(scriptPath, 0o755);
  log("Expect script created at %s", scriptPath);

  try {
    // Run the expect script with the specified working directory
    log(
      "Running expect script to handle interactive prompts in directory: %s",
      cwd || process.cwd(),
    );
    const result = await $({ cwd: cwd || process.cwd() })`${scriptPath}`;
    const stdout = result.stdout ?? "";
    console.log(stdout);

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
  } finally {
    // Clean up the temporary expect script
    log("Cleaning up temporary expect script");
    await tempExpectFile.cleanup().catch(() => {
      log("Warning: Failed to clean up temporary script file: %s", scriptPath);
      console.warn(
        `Warning: Failed to clean up temporary script file: ${scriptPath}`,
      );
    });
  }
}

/**
 * Launch a browser instance
 */
async function launchBrowser(browserPath?: string): Promise<Browser> {
  // Get browser path if not provided
  if (!browserPath) {
    log("Getting browser executable path");
    browserPath = await getBrowserPath();
  }

  log("Launching browser from %s", browserPath);
  console.log(`🚀 Launching browser from ${browserPath}`);

  log("Starting browser with puppeteer");
  return await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/**
 * Get the browser executable path
 */
async function getBrowserPath(): Promise<string> {
  log("Finding Chrome executable");
  console.log("Finding Chrome executable...");

  // First try using environment variable if set
  if (process.env.CHROME_PATH) {
    log("Using Chrome from environment variable: %s", process.env.CHROME_PATH);
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

  // Resolve the buildId for the stable Chrome version - do this once
  log("Resolving Chrome buildId for stable channel");
  const buildId = await resolveBuildId(
    PuppeteerBrowser.CHROMIUM,
    platform,
    "stable",
  );
  log("Resolved buildId: %s", buildId);
  console.log(`Resolved Chrome buildId: ${buildId}`);

  // Create installation options - use them consistently
  const options: InstallOptions & { unpack: true } = {
    browser: PuppeteerBrowser.CHROMIUM,
    platform,
    cacheDir: rwCacheDir,
    buildId,
    unpack: true,
  };

  try {
    // Try to compute the path first (this will check if it's installed)
    log("Attempting to find existing Chrome installation");
    const path = computeExecutablePath(options);
    if (await pathExists(path)) {
      log("Found existing Chrome at: %s", path);
      console.log(`Found existing Chrome at: ${path}`);
      return path;
    } else {
      throw new Error("Chrome not found at: " + path);
    }
  } catch (error) {
    // If path computation fails, install Chrome
    log("No Chrome installation found, installing Chrome");
    console.log("No Chrome installation found. Installing Chrome...");

    // Add better error handling for the install step
    try {
      log("Starting Chrome download with options: %O", options);
      console.log("Downloading Chrome (this may take a few minutes)...");
      await install(options);
      log("Chrome installation completed successfully");
      console.log("✅ Chrome installation completed successfully");

      // Now compute the path for the installed browser
      const path = computeExecutablePath(options);
      log("Installed and using Chrome at: %s", path);
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

/**
 * Check if a server is running at the given URL
 */
async function checkServerUp(url: string, retries = RETRIES): Promise<boolean> {
  log("Checking if server is up at %s (max retries: %d)", url, retries);

  for (let i = 0; i < retries; i++) {
    try {
      log("Attempt %d/%d to check server at %s", i + 1, retries, url);
      console.log(
        `Checking if server is up at ${url} (attempt ${i + 1}/${retries})...`,
      );
      await $`curl -s -o /dev/null -w "%{http_code}" ${url}`;
      log("Server is up at %s", url);
      return true;
    } catch (error) {
      if (i === retries - 1) {
        log(
          "ERROR: Server at %s did not become available after %d attempts",
          url,
          retries,
        );
        throw new Error(
          `Server at ${url} did not become available after ${retries} attempts`,
        );
      }
      log("Server not up yet, retrying in 2 seconds");
      console.log(`Server not up yet, retrying in 2 seconds...`);
      await setTimeout(2000);
    }
  }

  // This should never be reached due to the throw above, but TypeScript needs it
  return false;
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
    log("%s%s smoke test passed", phasePrefix, type);
    console.log(`✅ ${phasePrefix}${type} smoke test passed!`);
    if (result.serverTimestamp) {
      log("Server timestamp: %d", result.serverTimestamp);
      console.log(`✅ Server timestamp: ${result.serverTimestamp}`);
    }
    if (result.clientTimestamp) {
      log("Client timestamp: %d", result.clientTimestamp);
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
  log("Deleting worker: %s", name);
  console.log(`Cleaning up: Deleting worker ${name}...`);
  try {
    // The --yes flag automatically confirms the deletion
    log(
      "Running wrangler delete command in directory: %s",
      cwd || process.cwd(),
    );
    await $({ cwd: cwd || process.cwd() })`npx wrangler delete ${name} --yes`;
    log("Worker %s deleted successfully", name);
    console.log(`✅ Worker ${name} deleted successfully`);
  } catch (error) {
    log("Failed to delete worker %s: %O", name, error);
    console.error(`Failed to delete worker ${name}: ${error}`);
    // Retry with force flag if the first attempt failed
    try {
      log("Retrying with force flag");
      console.log("Retrying with force flag...");
      await $({
        cwd: cwd || process.cwd(),
      })`npx wrangler delete ${name} --yes --force`;
      log("Worker %s force deleted successfully", name);
      console.log(`✅ Worker ${name} force deleted successfully`);
    } catch (retryError) {
      log("Failed to force delete worker %s: %O", name, retryError);
      console.error(`Failed to force delete worker ${name}: ${retryError}`);
    }
  }
}

/**
 * Creates the smoke test components in the target project directory
 */
async function createSmokeTestComponents(targetDir: string): Promise<void> {
  log("Creating smoke test components in project directory: %s", targetDir);
  console.log("Creating smoke test components in project...");

  // Create directories if they don't exist
  const componentsDir = join(targetDir, "src", "app", "components");
  log("Creating components directory: %s", componentsDir);
  await fs.mkdir(componentsDir, { recursive: true });

  // Create SmokeTest.tsx
  const smokeTestPath = join(componentsDir, "__SmokeTest.tsx");
  log("Creating SmokeTest component at: %s", smokeTestPath);
  const smokeTestContent = `"use client";

import React from "react";
import { RequestInfo } from "rwsdk/worker";
import { SmokeTestClient } from "./__SmokeTestClient";

export const SmokeTestInfo: React.FC = async () => {
  const timestamp = Date.now();
  let status = "error";
  let verificationPassed = false;
  let result: any = null;

  try {
    result = await globalThis.__rw.callServer("__smoke_test", [timestamp]);

    // Check the result
    if (typeof result === "object" && result !== null) {
      status = result.status || "error";
      verificationPassed = result.timestamp === timestamp;
    } else if (result === "ok") {
      status = "ok";
      verificationPassed = true;
    }
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

      {/* Include the client component for on-demand smoke tests */}
      <SmokeTestClient />
    </div>
  );
};

/**
 * Standalone smoke test page that conforms to the RouteComponent type
 */
export const SmokeTestPage = (
  requestInfo: RequestInfo
): React.JSX.Element => {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <h1>RedwoodJS SDK Smoke Test</h1>
      <SmokeTestInfo />
      <p style={{ marginTop: "20px" }}>
        This is a dedicated smoke test page to verify that your RedwoodJS SDK
        application is functioning correctly. It tests that server-side
        rendering, client-side hydration, and RSC (React Server Components)
        actions are all working properly.
      </p>
      <p>
        Use the button below to manually trigger a new smoke test at any time.
      </p>
    </div>
  );
};`;

  // Create SmokeTestClient.tsx
  const smokeTestClientPath = join(componentsDir, "__SmokeTestClient.tsx");
  log("Creating SmokeTestClient component at: %s", smokeTestClientPath);
  const smokeTestClientContent = `"use client";

import React, { useState } from "react";

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
    try {
      // Get current timestamp to verify round-trip
      const timestamp = Date.now();

      const result = await globalThis.__rw.callServer("__smoke_test", [timestamp]);

      // Process the result
      let status = "error";
      let verificationPassed = false;

      if (typeof result === "object" && result !== null) {
        const typedResult = result as SmokeTestResponse;
        status = typedResult.status || "error";
        verificationPassed = typedResult.timestamp === timestamp;
      } else if (result === "ok") {
        status = "ok";
        verificationPassed = true;
      }

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
        timestamp: Date.now(),
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
        style={{ display: "none" }}
      />
    </div>
  );
};`;

  // Write the files
  log("Writing SmokeTest component file");
  await fs.writeFile(smokeTestPath, smokeTestContent);
  log("Writing SmokeTestClient component file");
  await fs.writeFile(smokeTestClientPath, smokeTestClientContent);

  log("Smoke test components created successfully");
  console.log("Created smoke test components:");
  console.log(`- ${smokeTestPath}`);
  console.log(`- ${smokeTestClientPath}`);
}

// Run the smoke test if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  log("Command line arguments: %O", args);

  const options: SmokeTestOptions = {
    customPath: args.find(
      (arg) => !arg.startsWith("--") && !arg.startsWith("--path="),
    ),
    skipDev: args.includes("--skip-dev"),
    skipRelease: args.includes("--skip-release"),
    projectDir: args.find((arg) => arg.startsWith("--path="))?.substring(7),
    artifactDir: args
      .find((arg) => arg.startsWith("--artifact-dir="))
      ?.substring(15),
    keep: args.includes("--keep"),
  };

  log("Parsed options: %O", options);

  // Print help if requested
  if (args.includes("--help") || args.includes("-h")) {
    log("Showing help message");
    console.log(`
Smoke Test Usage:
  node smoke-test.mjs [options] [custom-path]

Options:
  --skip-dev              Skip testing the local development server
  --skip-release          Skip testing the release/production deployment
  --path=PATH             Project directory to test
  --artifact-dir=DIR      Directory to store test artifacts
  --keep                  Don't delete the temporary project directory after tests
  --help, -h              Show this help message

Arguments:
  custom-path             Optional path to test (e.g., "/login")

Examples:
  pnpm smoke-test                                # Test both dev and release with default path
  pnpm smoke-test /login                         # Test both dev and release with /login path
  pnpm smoke-test --skip-release                 # Only test dev server
  pnpm smoke-test --path=./my-project            # Test using the specified project directory
  pnpm smoke-test --path=./my-project --keep     # Keep the test directory after completion
  pnpm smoke-test --path=./my-project --artifact-dir=./artifacts  # Store artifacts in ./artifacts
`);
    // No error, just showing help
    log("Exiting after showing help");
    process.exit(0);
  }

  // Run the main function
  log("Starting smoke test");
  main(options)
    .then(() => {
      log("Smoke test completed successfully");
      console.log("✨ Smoke test completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      log("ERROR: Smoke test failed: %O", error);
      console.error(`❌ Smoke test failed: ${error.message}`);
      process.exit(1);
    });
}

export { main, checkUrl, checkUrlSmoke, checkServerSmoke, checkClientSmoke };
