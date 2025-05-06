import { $ } from "../lib/$.mjs";
import puppeteer from "puppeteer-core";
import { setTimeout } from "node:timers/promises";
import { resolve } from "path";
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

const TIMEOUT = 30000; // 30 seconds timeout
const RETRIES = 3;

interface HealthCheckResult {
  status: string;
  verificationPassed: boolean;
  timestamp?: number;
  rawResult?: unknown;
  error?: string;
  serverTimestamp?: number;
  clientTimestamp?: number;
}

// Define the expected health check response type
interface HealthCheckResponse {
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
  } = {},
) {
  const customPath = options.customPath || "";
  const pathSuffix = customPath
    ? customPath.startsWith("/")
      ? customPath
      : `/${customPath}`
    : "";

  try {
    // Default to running both tests
    const skipDev = Boolean(options.skipDev);
    const skipRelease = Boolean(options.skipRelease);

    // Ensure at least one test runs
    if (skipDev && skipRelease) {
      console.log(
        "⚠️ Warning: Both dev and release tests were skipped via command line flags.",
      );
      console.log(
        "⚠️ At least one test environment must be tested. Running dev test by default.",
      );

      // Run dev test by default if both are skipped
      await runDevTest(pathSuffix);
    } else {
      // Run the tests that weren't skipped
      if (!skipDev) {
        await runDevTest(pathSuffix);
      }

      if (!skipRelease) {
        await runReleaseTest(pathSuffix);
      }
    }

    console.log("\n✅ All smoke tests completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Smoke test failed:", error);
    process.exit(1);
  }
}

/**
 * Run the development server test
 */
async function runDevTest(pathSuffix: string): Promise<void> {
  console.log("🚀 STEP 1: Testing local development server");
  const { url, stopDev } = await runDevServer();
  await checkUrl(url + pathSuffix);
  await stopDev();
}

/**
 * Run the release/production test
 */
async function runReleaseTest(pathSuffix: string): Promise<void> {
  console.log("\n🚀 STEP 2: Testing production deployment");
  const { url } = await runRelease();
  await checkUrl(url + pathSuffix);
}

/**
 * Check a URL by performing health checks and realtime upgrade
 */
async function checkUrl(url: string): Promise<void> {
  console.log(`🔍 Testing URL: ${url}`);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT);

    // Initial health check
    await checkUrlHealth(page, url, false);

    // Upgrade to realtime and check again
    await upgradeToRealtime(page);
    await page.reload({ waitUntil: "networkidle0" });
    await checkUrlHealth(page, url, true);

    // Take a screenshot for CI artifacts if needed
    await page.screenshot({ path: "smoke-test-result.png" });
  } finally {
    await browser.close();
  }
}

/**
 * Check health for a specific URL
 */
async function checkUrlHealth(
  page: Page,
  url: string,
  isRealtime: boolean,
): Promise<void> {
  const phase = isRealtime ? "Post-upgrade" : "Initial";
  console.log(`🔍 Testing ${phase} health checks at ${url}`);

  // Parse the base URL and path to properly handle health check queries
  const parsedUrl = new URL(url);

  // Add __health query parameter, preserving any existing query parameters
  if (parsedUrl.searchParams.has("__health")) {
    console.log(`URL already has __health parameter: ${url}`);
  } else {
    parsedUrl.searchParams.append("__health", "1");
  }

  // Navigate to health check page
  const healthUrl = parsedUrl.toString();
  console.log(`🔍 Accessing health check page: ${healthUrl}`);
  await page.goto(healthUrl, { waitUntil: "networkidle0" });

  // Run server-side health check
  await checkServerHealth(page, phase);

  // Run client-side health check if available
  await checkClientHealth(page, phase);
}

/**
 * Check server-side health
 */
async function checkServerHealth(
  page: Page,
  phase: string = "",
): Promise<HealthCheckResult> {
  console.log(
    `🔍 Testing server-side health check ${phase ? `(${phase})` : ""}`,
  );

  const result = await page.evaluate(async () => {
    try {
      // Look for health status indicator in the page
      const healthElement = document.querySelector(
        '[data-testid="health-status"]',
      );
      if (!healthElement) {
        return {
          status: "error",
          verificationPassed: false,
          error: "Health status element not found in the page",
        };
      }

      const status = healthElement.getAttribute("data-status");
      const timestamp = parseInt(
        healthElement.getAttribute("data-timestamp") || "0",
        10,
      );
      const serverTimestamp = parseInt(
        healthElement.getAttribute("data-server-timestamp") || "0",
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
          status !== "ok" ? "Health check did not return ok status" : undefined,
      };
    } catch (error) {
      return {
        status: "error",
        verificationPassed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  reportHealthCheckResult(result, "Server-side", phase);
  return result;
}

/**
 * Check client-side health if refresh button is available
 */
async function checkClientHealth(
  page: Page,
  phase: string = "",
): Promise<HealthCheckResult | null> {
  console.log(
    `🔍 Testing client-side health check ${phase ? `(${phase})` : ""}`,
  );

  // Check if refresh button exists
  const refreshButtonExists = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="refresh-health"]');
    return !!button;
  });

  if (!refreshButtonExists) {
    console.warn(
      "⚠️ No client-side refresh button found - this is expected only if testing a non-health page",
    );

    // Look for any other evidence that the page is working
    const pageContent = await page.content();
    if (!pageContent.includes("<!DOCTYPE html>")) {
      console.error("❌ Page doesn't appear to be a valid HTML document");
      process.exit(1);
    }

    // Check if we're on a health check page - in which case missing the refresh button is a failure
    const currentUrl = page.url();
    if (currentUrl.includes("__health")) {
      console.error(
        "❌ Health check page is missing the refresh-health button - this is a test failure",
      );
      process.exit(1);
    }

    console.log(
      "ℹ️ Basic page structure verified, continuing without client-side health check",
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
    console.error(
      "❌ Timed out waiting for client-side health check to complete",
    );
    process.exit(1);
  }

  const result = await page.evaluate(async () => {
    try {
      const healthElement = document.querySelector(
        '[data-testid="health-status"]',
      );
      if (!healthElement) {
        return {
          status: "error",
          verificationPassed: false,
          error: "Health status element not found in the page",
        };
      }

      const status = healthElement.getAttribute("data-status");
      const clientTimestamp = parseInt(
        healthElement.getAttribute("data-client-timestamp") || "0",
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
            ? "Client health check did not return ok status"
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

  reportHealthCheckResult(result, "Client-side", phase);
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

  if (upgradeResult.success) {
    console.log("✅ Successfully upgraded to realtime mode");
  } else {
    console.error(
      `❌ Failed to upgrade to realtime mode: ${upgradeResult.message}`,
    );
    process.exit(1);
  }
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
 * Run the release process and return the deployed URL
 */
async function runRelease(): Promise<{ url: string }> {
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

  // Write the expect script to a temporary file
  const scriptPath = resolve(process.cwd(), "release-script.exp");
  await fs.writeFile(scriptPath, expectScript);
  await fs.chmod(scriptPath, 0o755);

  try {
    // Run the expect script
    const result = await $({ shell: true })`${scriptPath}`;
    const stdout = result.stdout ?? "";
    console.log(stdout);

    // Extract deployment URL from output
    const urlMatch = stdout.match(
      /https:\/\/[a-zA-Z0-9-]+\.redwoodjs\.workers\.dev/,
    );
    if (!urlMatch || !urlMatch[0]) {
      throw new Error("Could not extract deployment URL from release output");
    }

    const url = urlMatch[0];
    console.log(`✅ Successfully deployed to ${url}`);

    return { url };
  } finally {
    // Clean up the temporary expect script
    await fs.unlink(scriptPath).catch(() => {});
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
  try {
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
  } catch (error) {
    console.error("❌ Failed to find Chrome executable:", error);
    process.exit(1);
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
      console.log(`Server not up yet, retrying in 2 seconds...`);
      await setTimeout(2000);
    }
  }
  return false;
}

/**
 * Report the health check result
 */
function reportHealthCheckResult(
  result: HealthCheckResult,
  type: string,
  phase: string = "",
): void {
  const phasePrefix = phase ? `(${phase}) ` : "";

  if (result.verificationPassed) {
    console.log(`✅ ${phasePrefix}${type} health check passed!`);
    if (result.serverTimestamp) {
      console.log(`✅ Server timestamp: ${result.serverTimestamp}`);
    }
    if (result.clientTimestamp) {
      console.log(`✅ Client timestamp: ${result.clientTimestamp}`);
    }
  } else {
    console.error(
      `❌ ${phasePrefix}${type} health check failed. Status: ${result.status}`,
    );
    if (result.error) {
      console.error(`❌ Error: ${result.error}`);
    }
    process.exit(1);
  }
}

// Run the smoke test if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    customPath: args.find((arg) => !arg.startsWith("--")),
    skipDev: args.includes("--skip-dev"),
    skipRelease: args.includes("--skip-release"),
  };

  // Print help if requested
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Smoke Test Usage:
  node smoke-test.mjs [options] [custom-path]

Options:
  --skip-dev       Skip testing the local development server
  --skip-release   Skip testing the release/production deployment
  --help, -h       Show this help message

Arguments:
  custom-path      Optional path to test (e.g., "/login")

Examples:
  node smoke-test.mjs              # Test both dev and release with default path
  node smoke-test.mjs /login       # Test both dev and release with /login path
  node smoke-test.mjs --skip-release # Only test dev server
`);
    process.exit(0);
  }

  main(options).catch((error) => {
    console.error("❌ Unhandled error in smoke test:", error);
    process.exit(1);
  });
}

export { main, checkUrl, checkUrlHealth, checkServerHealth, checkClientHealth };
