import { $ } from "../lib/$.mjs";
import puppeteer from "puppeteer-core";
import { setTimeout } from "node:timers/promises";
import { resolve, basename, join, relative } from "path";
import { fileURLToPath } from "url";
import * as process from "process";
import * as fs from "fs/promises";
import {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
  Browser as PuppeteerBrowser,
} from "@puppeteer/browsers";
import type { Page, Browser } from "puppeteer-core";
import { spawn } from "child_process";
import { copy, pathExists } from "fs-extra";
import tmp from "tmp-promise";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import ignore from "ignore";

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

/**
 * Main function that orchestrates the smoke test flow
 */
async function main(
  options: {
    customPath?: string;
    skipDev?: boolean;
    skipRelease?: boolean;
    projectDir?: string;
    artifactDir?: string;
  } = {},
) {
  // Throw immediately if both tests would be skipped
  if (options.skipDev && options.skipRelease) {
    throw new Error(
      "Cannot skip both dev and release tests. At least one must run.",
    );
  }

  const resources = await setupTestEnvironment(options);

  try {
    // Run the tests that weren't skipped
    if (!options.skipDev) {
      await runDevTest(options.customPath, options.artifactDir);
    }

    if (!options.skipRelease) {
      await runReleaseTest(options.customPath, resources, options.artifactDir);
    }

    console.log("\n✅ All smoke tests passed!");
  } finally {
    await cleanupResources(resources);
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
}> {
  const resources: {
    tempDirCleanup?: () => Promise<void>;
    workerName?: string;
    originalCwd: string;
  } = {
    tempDirCleanup: undefined,
    workerName: undefined,
    originalCwd: process.cwd(),
  };

  // If a project dir is specified, copy it to a temp dir with a unique name
  if (options.projectDir) {
    const { tempDir, targetDir, workerName } = await copyProjectToTempDir(
      options.projectDir,
    );

    // Store cleanup function
    resources.tempDirCleanup = tempDir.cleanup;
    resources.workerName = workerName;

    // Change to the new directory for the tests
    process.chdir(targetDir);

    // Create the smoke test components in the user's project
    await createSmokeTestComponents(targetDir);
  }

  return resources;
}

/**
 * Runs tests against the development server
 */
async function runDevTest(
  customPath?: string,
  artifactDir?: string,
): Promise<void> {
  console.log("🚀 Testing local development server");
  const pathSuffix = formatPathSuffix(customPath);

  const { url, stopDev } = await runDevServer();
  await checkUrl(url + pathSuffix, artifactDir);
  await stopDev();
}

/**
 * Runs tests against the production deployment
 */
async function runReleaseTest(
  customPath?: string,
  resources?: { workerName?: string },
  artifactDir?: string,
): Promise<void> {
  console.log("\n🚀 Testing production deployment");
  const pathSuffix = formatPathSuffix(customPath);

  const { url, workerName } = await runRelease();
  await checkUrl(url + pathSuffix, artifactDir);

  // Store the worker name if we didn't set it earlier
  if (resources && !resources.workerName) {
    resources.workerName = workerName;
  }
}

/**
 * Cleans up any resources used during testing
 */
async function cleanupResources(resources: {
  tempDirCleanup?: () => Promise<void>;
  workerName?: string;
  originalCwd: string;
}): Promise<void> {
  // Restore original working directory
  process.chdir(resources.originalCwd);

  // Clean up resources
  if (resources.workerName) {
    await deleteWorker(resources.workerName);
  }

  if (resources.tempDirCleanup) {
    await resources.tempDirCleanup();
  }
}

/**
 * Formats the path suffix from a custom path
 */
function formatPathSuffix(customPath?: string): string {
  return customPath
    ? customPath.startsWith("/")
      ? customPath
      : `/${customPath}`
    : "";
}

/**
 * Copy project to a temporary directory with a unique name
 */
async function copyProjectToTempDir(projectDir: string): Promise<{
  tempDir: tmp.DirectoryResult;
  targetDir: string;
  workerName: string;
}> {
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

  console.log(`Copying project from ${projectDir} to ${targetDir}`);

  // Read project's .gitignore if it exists
  let ig = ignore();
  const gitignorePath = join(projectDir, ".gitignore");

  if (await pathExists(gitignorePath)) {
    const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    ig = ig.add(gitignoreContent);
  } else {
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
  await copy(projectDir, targetDir, {
    filter: (src) => {
      // Get path relative to project directory
      const relativePath = relative(projectDir, src);
      if (!relativePath) return true; // Include the root directory

      // Check against ignore patterns
      return !ig.ignores(relativePath);
    },
  });

  return { tempDir, targetDir, workerName };
}

/**
 * Check a URL by performing smoke tests and realtime upgrade
 */
async function checkUrl(url: string, artifactDir?: string): Promise<void> {
  console.log(`🔍 Testing URL: ${url}`);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT);

    // Initial smoke test
    await checkUrlSmoke(page, url, false);

    // Upgrade to realtime and check again
    await upgradeToRealtime(page);
    await page.reload({ waitUntil: "networkidle0" });
    await checkUrlSmoke(page, url, true);

    // Take a screenshot for CI artifacts if needed
    const screenshotPath = artifactDir
      ? `${artifactDir}/smoke-test-result.png`
      : "smoke-test-result.png";

    // Ensure the artifact directory exists
    if (artifactDir) {
      await fs.mkdir(artifactDir, { recursive: true });
    }

    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved to ${screenshotPath}`);
  } finally {
    await browser.close();
  }
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
  console.log(`🔍 Testing ${phase} smoke tests at ${url}`);

  // Parse the base URL and path to properly handle smoke test queries
  const parsedUrl = new URL(url);

  // Add __smoke_test query parameter, preserving any existing query parameters
  if (parsedUrl.searchParams.has("__smoke_test")) {
    console.log(`URL already has __smoke_test parameter: ${url}`);
  } else {
    parsedUrl.searchParams.append("__smoke_test", "1");
  }

  // Navigate to smoke test page
  const smokeUrl = parsedUrl.toString();
  console.log(`🔍 Accessing smoke test page: ${smokeUrl}`);
  await page.goto(smokeUrl, { waitUntil: "networkidle0" });

  // Run server-side smoke test
  await checkServerSmoke(page, phase);

  // Run client-side smoke test if available
  await checkClientSmoke(page, phase);
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
  const refreshButtonExists = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="refresh-health"]');
    return !!button;
  });

  if (!refreshButtonExists) {
    console.warn(
      "⚠️ No client-side refresh button found - this is expected only if testing a non-smoke test page",
    );

    // Look for any other evidence that the page is working
    const pageContent = await page.content();
    if (!pageContent.includes("<!DOCTYPE html>")) {
      throw new Error("Page doesn't appear to be a valid HTML document");
    }

    // Check if we're on a smoke test page - in which case missing the refresh button is a failure
    const currentUrl = page.url();
    if (currentUrl.includes("__smoke_test")) {
      throw new Error(
        "Smoke test page is missing the refresh-health button - this is a test failure",
      );
    }

    console.log(
      "ℹ️ Basic page structure verified, continuing without client-side smoke test",
    );
    return null;
  }

  await page.click('[data-testid="refresh-health"]');

  // Wait for client-side update to complete
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
  } catch (error) {
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
    throw new Error(
      `Failed to upgrade to realtime mode: ${upgradeResult.message}`,
    );
  }

  console.log("✅ Successfully upgraded to realtime mode");
}

/**
 * Run the local development server and return the URL
 */
async function runDevServer(): Promise<{
  url: string;
  stopDev: () => Promise<void>;
}> {
  console.log("🚀 Starting development server...");

  // Start dev server
  const devProcess = spawn("npm", ["run", "dev"], {
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });

  // Store chunks to parse the URL
  const chunks: Buffer[] = [];

  // Create a promise that resolves when we find the URL
  let resolveDevServer: (value: string) => void;
  const devServerPromise = new Promise<string>((resolve) => {
    resolveDevServer = resolve;
  });

  // Listen for stdout to get the URL
  devProcess.stdout.on("data", (data) => {
    chunks.push(Buffer.from(data));
    const output = Buffer.concat(chunks).toString();
    console.log(output);

    // Try to extract the URL from the server output
    const localMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
    if (localMatch && localMatch[1]) {
      resolveDevServer(localMatch[1]);
    }
  });

  // Function to stop the dev server
  const stopDev = async () => {
    console.log("Stopping development server...");
    devProcess.kill();
    await new Promise<void>((resolve) => {
      devProcess.on("exit", () => {
        console.log("Development server stopped");
        resolve();
      });
    });
  };

  // Wait for URL with timeout
  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(60000).then(() => {
      reject(new Error("Timed out waiting for dev server URL"));
    });
  });

  // Wait for either the URL or timeout
  const url = await Promise.race([devServerPromise, timeoutPromise]);

  console.log(`✅ Development server started at ${url}`);
  return { url, stopDev };
}

/**
 * Run the release process and return the deployed URL and worker name
 */
async function runRelease(): Promise<{ url: string; workerName: string }> {
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

  // Create a temporary file for the expect script
  const tempExpectFile = await tmp.file({ postfix: ".exp" });
  const scriptPath = tempExpectFile.path;

  await fs.writeFile(scriptPath, expectScript);
  await fs.chmod(scriptPath, 0o755);

  try {
    // Run the expect script
    const result = await $({ shell: true })`${scriptPath}`;
    const stdout = result.stdout ?? "";
    console.log(stdout);

    // Extract deployment URL from output
    const urlMatch = stdout.match(
      /https:\/\/([a-zA-Z0-9-]+)\.redwoodjs\.workers\.dev/,
    );
    if (!urlMatch || !urlMatch[0]) {
      throw new Error("Could not extract deployment URL from release output");
    }

    const url = urlMatch[0];
    const workerName = urlMatch[1];
    console.log(`✅ Successfully deployed to ${url}`);

    return { url, workerName };
  } finally {
    // Clean up the temporary expect script
    await tempExpectFile.cleanup().catch(() => {
      console.warn(
        `Warning: Failed to clean up temporary script file: ${scriptPath}`,
      );
    });
  }
}

/**
 * Launch a browser instance
 */
async function launchBrowser(): Promise<Browser> {
  // Get browser path
  const browserPath = await getBrowserPath();
  console.log(`🚀 Launching browser from ${browserPath}`);

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
  console.log("Finding Chrome executable...");
  // First try using environment variable if set
  if (process.env.CHROME_PATH) {
    console.log(
      `Using Chrome from environment variable: ${process.env.CHROME_PATH}`,
    );
    return process.env.CHROME_PATH;
  }

  // Use a more direct approach to avoid type issues
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error("Failed to detect browser platform");
  }

  // Bypass type issues by using 'any'
  try {
    // Try to compute the path first (this will check if it's installed)
    const options: any = { browser: "chrome", platform };
    const path = computeExecutablePath(options);
    console.log(`Found existing Chrome at: ${path}`);
    return path;
  } catch (error) {
    // If path computation fails, install Chrome
    console.log("No Chrome installation found. Installing Chrome...");
    const installOptions: any = { browser: "chrome", platform };
    await install(installOptions);

    // Now compute the path for the installed browser
    const options: any = { browser: "chrome", platform };
    const path = computeExecutablePath(options);
    console.log(`Installed and using Chrome at: ${path}`);
    return path;
  }
}

/**
 * Check if a server is running at the given URL
 */
async function checkServerUp(url: string, retries = RETRIES): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `Checking if server is up at ${url} (attempt ${i + 1}/${retries})...`,
      );
      await $`curl -s -o /dev/null -w "%{http_code}" ${url}`;
      return true;
    } catch (error) {
      if (i === retries - 1) {
        throw new Error(
          `Server at ${url} did not become available after ${retries} attempts`,
        );
      }
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

  if (result.verificationPassed) {
    console.log(`✅ ${phasePrefix}${type} smoke test passed!`);
    if (result.serverTimestamp) {
      console.log(`✅ Server timestamp: ${result.serverTimestamp}`);
    }
    if (result.clientTimestamp) {
      console.log(`✅ Client timestamp: ${result.clientTimestamp}`);
    }
  } else {
    throw new Error(
      `${phasePrefix}${type} smoke test failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`,
    );
  }
}

/**
 * Delete the worker using wrangler
 */
async function deleteWorker(name: string): Promise<void> {
  console.log(`Cleaning up: Deleting worker ${name}...`);
  try {
    // The --yes flag automatically confirms the deletion
    await $`npx wrangler delete ${name} --yes`;
    console.log(`✅ Worker ${name} deleted successfully`);
  } catch (error) {
    console.error(`Failed to delete worker ${name}: ${error}`);
    // Retry with force flag if the first attempt failed
    try {
      console.log("Retrying with force flag...");
      await $`npx wrangler delete ${name} --yes --force`;
      console.log(`✅ Worker ${name} force deleted successfully`);
    } catch (retryError) {
      console.error(`Failed to force delete worker ${name}: ${retryError}`);
    }
  }
}

/**
 * Creates the smoke test components in the target project directory
 */
async function createSmokeTestComponents(targetDir: string): Promise<void> {
  console.log("Creating smoke test components in project...");

  // Create directories if they don't exist
  const componentsDir = join(targetDir, "src", "app", "components");
  await fs.mkdir(componentsDir, { recursive: true });

  // Create SmokeTest.tsx
  const smokeTestPath = join(componentsDir, "__SmokeTest.tsx");
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
  await fs.writeFile(smokeTestPath, smokeTestContent);
  await fs.writeFile(smokeTestClientPath, smokeTestClientContent);

  console.log("Created smoke test components:");
  console.log(`- ${smokeTestPath}`);
  console.log(`- ${smokeTestClientPath}`);
}

// Run the smoke test if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    customPath: args.find(
      (arg) => !arg.startsWith("--") && !arg.startsWith("--path="),
    ),
    skipDev: args.includes("--skip-dev"),
    skipRelease: args.includes("--skip-release"),
    projectDir: args.find((arg) => arg.startsWith("--path="))?.substring(7),
    artifactDir: args
      .find((arg) => arg.startsWith("--artifact-dir="))
      ?.substring(15),
  };

  // Print help if requested
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Smoke Test Usage:
  node smoke-test.mjs [options] [custom-path]

Options:
  --skip-dev              Skip testing the local development server
  --skip-release          Skip testing the release/production deployment
  --path=PATH             Project directory to test
  --artifact-dir=DIR      Directory to store test artifacts
  --help, -h              Show this help message

Arguments:
  custom-path             Optional path to test (e.g., "/login")

Examples:
  pnpm run smoke-test                                # Test both dev and release with default path
  pnpm run smoke-test /login                         # Test both dev and release with /login path
  pnpm run smoke-test --skip-release                 # Only test dev server
  pnpm run smoke-test --path=./my-project            # Test using the specified project directory
  pnpm run smoke-test --path=./my-project --artifact-dir=./artifacts  # Store artifacts in ./artifacts
`);
    // No error, just showing help
    process.exit(0);
  }

  // Run the main function
  main(options)
    .then(() => {
      console.log("✨ Smoke test completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error(`❌ Smoke test failed: ${error.message}`);
      process.exit(1);
    });
}

export { main, checkUrl, checkUrlSmoke, checkServerSmoke, checkClientSmoke };
