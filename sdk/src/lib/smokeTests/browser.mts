import * as os from "os";
import { join } from "path";
import { pathExists } from "fs-extra";
import { log } from "./constants.mjs";
import { mkdirp } from "fs-extra";
import { SmokeTestOptions, SmokeTestResult } from "./types.mjs";
import {
  install,
  canDownload,
  resolveBuildId,
  computeExecutablePath,
  detectBrowserPlatform,
  Browser as PuppeteerBrowser,
  type InstallOptions,
} from "@puppeteer/browsers";
import type { Page, Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import { takeScreenshot } from "./artifacts.mjs";
import { RETRIES } from "./constants.mjs";
import { $ } from "../$.mjs";
import { fail } from "./utils.mjs";
import { reportSmokeTestResult } from "./reporting.mjs";
import { updateTestStatus } from "./state.mjs";
import { TestStatus } from "./state.mjs";

export async function checkUrlStyles(
  page: Page,
  expectedColor: "red" | "green",
): Promise<void> {
  const selector = '[data-testid="smoke-test-url-styles"]';
  log(`Checking for element with selector: ${selector}`);
  const element = await page.waitForSelector(selector);
  if (!element) {
    throw new Error(`URL styles element not found with selector: ${selector}`);
  }

  const backgroundColor = await page.evaluate(
    (selector) =>
      window.getComputedStyle(document.querySelector(selector)!)
        .backgroundColor,
    selector,
  );

  const expectedRgb =
    expectedColor === "red" ? "rgb(255, 0, 0)" : "rgb(0, 128, 0)";
  if (backgroundColor !== expectedRgb) {
    throw new Error(
      `URL-based stylesheet check failed: expected background color ${expectedRgb}, but got ${backgroundColor}`,
    );
  }
  log(
    `URL-based stylesheet check passed: background color is ${backgroundColor}`,
  );
}

export async function checkClientModuleStyles(
  page: Page,
  expectedColor: "blue" | "green",
): Promise<void> {
  const selector = '[data-testid="smoke-test-client-styles"]';
  log(`Checking for element with selector: ${selector}`);
  const element = await page.waitForSelector(selector);
  if (!element) {
    throw new Error(
      `Client module styles element not found with selector: ${selector}`,
    );
  }

  const backgroundColor = await page.evaluate(
    (selector) =>
      window.getComputedStyle(document.querySelector(selector)!)
        .backgroundColor,
    selector,
  );

  const expectedRgb =
    expectedColor === "blue" ? "rgb(0, 0, 255)" : "rgb(0, 128, 0)";
  if (backgroundColor !== expectedRgb) {
    throw new Error(
      `Client module stylesheet check failed: expected background color ${expectedRgb}, but got ${backgroundColor}`,
    );
  }
  log(
    `Client module stylesheet check passed: background color is ${backgroundColor}`,
  );
}

/**
 * Launch a browser instance
 */
export async function launchBrowser(
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
export async function getBrowserPath(
  testOptions?: SmokeTestOptions,
): Promise<string> {
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

/**
 * Check a URL by performing smoke tests and realtime upgrade
 */
export async function checkUrl(
  url: string,
  artifactDir: string,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
  environment: string = "Development",
  realtime: boolean = false,
  targetDir?: string,
  skipHmr: boolean = false,
): Promise<void> {
  console.log(`🔍 Testing URL: ${url}`);

  log("Launching browser");
  let browser: Browser;
  try {
    browser = await launchBrowser(browserPath, headless);
  } catch (error) {
    // Use fail() directly for browser launch errors
    await fail(error, 1, `${environment} - Browser Launch`);
    return; // This will never be reached due to fail() exiting
  }

  // Track failures to report at the end
  let hasFailures = false;
  let initialTestError: Error | null = null;
  let realtimeTestError: Error | null = null;

  // Store timestamp values between test phases
  const timestampState = {
    initialServerValue: 23, // This is the default initial module-level value
    clientUpdatedValue: null as number | null,
  };

  try {
    log("Opening new page");
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    log("Set navigation timeout: %dms", 30000);

    if (realtime) {
      // If realtime flag is set, use the simplified flow that only does realtime testing
      log("Using realtime-only flow (--realtime option enabled)");
      console.log(
        "⏩ Skipping initial smoke tests and upgrade step (--realtime option enabled)",
      );

      // Skip upgradeToRealtime and just run the realtime tests directly
      try {
        log("Performing realtime-only smoke test");
        await realtimeOnlyFlow(
          page,
          url,
          artifactDir,
          bail,
          skipClient,
          environment,
          targetDir,
          skipHmr,
        );

        // Take a screenshot of the realtime test
        await takeScreenshot(
          page,
          url,
          artifactDir,
          `${environment.toLowerCase()}-realtime-passed`,
        );
      } catch (error) {
        hasFailures = true;
        realtimeTestError =
          error instanceof Error ? error : new Error(String(error));
        log("Error during realtime-only test: %O", error);
        console.error(`❌ Realtime test failed: ${realtimeTestError.message}`);

        // Take a failure screenshot
        await takeScreenshot(
          page,
          url,
          artifactDir,
          `${environment.toLowerCase()}-realtime-failed`,
        ).catch((e) => log("Failed to take error screenshot: %O", e));

        // If bail is true, propagate the error
        if (bail) {
          throw error;
        }
      }
    } else {
      // Normal flow with both initial and realtime tests
      // Initial smoke test
      log("Performing initial smoke test");
      let initialTestStatus = "passed";
      try {
        await checkUrlSmoke(
          page,
          url,
          false,
          bail,
          skipClient,
          environment,
          timestampState,
          targetDir,
          skipHmr,
        );
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
        `${environment.toLowerCase()}-initial-${initialTestStatus}`,
      );

      // Upgrade to realtime and check again
      log("Upgrading to realtime");
      let realtimeTestStatus = "passed";
      try {
        await upgradeToRealtime(page, environment, bail);
        log("Performing post-upgrade smoke test");
        await checkUrlSmoke(
          page,
          url,
          true,
          bail,
          skipClient,
          environment,
          timestampState,
          targetDir,
          skipHmr,
        );
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
        `${environment.toLowerCase()}-realtime-${realtimeTestStatus}`,
      );
    }

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
 * Check smoke test status for a specific URL
 */
export async function checkUrlSmoke(
  page: Page,
  url: string,
  isRealtime: boolean,
  bail: boolean = false,
  skipClient: boolean = false,
  environment: string = "Development",
  timestampState: {
    initialServerValue: number;
    clientUpdatedValue: number | null;
  },
  targetDir?: string,
  skipHmr: boolean = false,
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
  let initialServerTestError: Error | null = null;
  let clientTestError: Error | null = null;
  let serverRenderCheckError: Error | null = null;
  let hmrTestError: Error | null = null;
  let stylesheetTestError: Error | null = null;

  // Step 1: Run initial server-side smoke test to check the server state
  log("Running initial server-side smoke test");
  let initialServerResult;
  try {
    // For initial checks: use the fixed initial value (23)
    // For realtime checks: if we've previously updated the value, use that instead of 23
    // For HMR tests: if HMR happened, we'll be back to the initial value (23)
    const expectedValue =
      isRealtime && timestampState.clientUpdatedValue !== null && skipHmr
        ? timestampState.clientUpdatedValue
        : timestampState.initialServerValue;

    // Check that the server is returning the expected value
    initialServerResult = await checkServerSmoke(
      page,
      phase,
      environment,
      bail,
      expectedValue,
      false, // Not a server render check
    );
    log(
      `${phase} server-side check passed - module variable has expected value ${expectedValue}`,
    );

    // Store the current timestamp for potential future reference
    if (initialServerResult && initialServerResult.timestamp) {
      timestampState.initialServerValue = initialServerResult.timestamp;
    }
  } catch (error) {
    hasFailures = true;
    initialServerTestError =
      error instanceof Error ? error : new Error(String(error));
    log("Error during initial server-side smoke test: %O", error);
    console.error(
      `❌ ${phase} server-side smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    // If bail is true, stop the tests
    if (bail) {
      throw error;
    }

    console.log(
      "Continuing with client-side smoke test since --bail is not enabled...",
    );
  }

  // Step 1.5: Run stylesheet checks
  try {
    await checkUrlStyles(page, "red");
    await checkClientModuleStyles(page, "blue");
  } catch (error) {
    hasFailures = true;
    stylesheetTestError =
      error instanceof Error ? error : new Error(String(error));
    log("Error during stylesheet checks: %O", error);
    console.error(
      `❌ Stylesheet checks failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    if (bail) {
      throw error;
    }
  }

  // Skip client tests if requested
  if (skipClient) {
    log("Skipping client-side smoke test as requested");
    console.log("⏩ Skipping client-side smoke test as requested");

    // If we're running HMR tests and have a target directory
    if (!skipHmr && targetDir) {
      try {
        // Run server HMR test if client tests are skipped
        log("Running server HMR test");
        await testServerComponentHmr(page, targetDir, phase, environment, bail);
      } catch (error) {
        hasFailures = true;
        hmrTestError =
          error instanceof Error ? error : new Error(String(error));
        log("Error during HMR test: %O", error);

        if (bail) {
          throw error;
        }
      }
    }

    return;
  }

  // Step 2: Run client-side smoke test to update the server timestamp
  log("Running client-side smoke test");
  let clientResult;
  try {
    clientResult = await checkClientSmoke(page, phase, environment, bail);

    // Store the client-updated timestamp for further tests
    if (clientResult && clientResult.clientTimestamp) {
      timestampState.clientUpdatedValue = clientResult.clientTimestamp;
      log(
        `Saved client timestamp ${clientResult.clientTimestamp} for verification`,
      );
    }
  } catch (error) {
    hasFailures = true;
    clientTestError = error instanceof Error ? error : new Error(String(error));
    log("Error during client-side smoke test: %O", error);
    console.error(
      `❌ Client-side smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    // If bail is true, stop the tests
    if (bail) {
      throw error;
    }

    console.log(
      "Continuing with server render check since --bail is not enabled...",
    );
  }

  // Step 3: Check if the server has rendered with the updated timestamp (server render check)
  if (clientResult && clientResult.clientTimestamp) {
    log("Running server render check with client timestamp");
    // Wait a moment for any server renders to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      await checkServerSmoke(
        page,
        phase,
        environment,
        bail,
        clientResult.clientTimestamp, // Expected to match the client-set timestamp
        true, // This is a server render check
      );
      log(
        "Server render check passed - server has updated with client timestamp",
      );
    } catch (error) {
      hasFailures = true;
      serverRenderCheckError =
        error instanceof Error ? error : new Error(String(error));
      log("Error during server render check: %O", error);
      console.error(
        `❌ Server render check failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      // If bail is true, stop the tests
      if (bail) {
        throw error;
      }
    }
  } else {
    log("Skipping server render check - no client timestamp available");

    // Update test status for server render check as skipped
    const env = environment === "Development" ? "dev" : "production";
    const serverRenderKey =
      phase === "Initial" || !phase
        ? "initialServerRenderCheck"
        : "realtimeServerRenderCheck";

    updateTestStatus(
      env,
      serverRenderKey as keyof TestStatus[typeof env],
      "SKIPPED",
    );
  }

  // Step 4: Run HMR tests if target directory is provided and HMR tests are not skipped
  if (!skipHmr && targetDir && environment === "Development") {
    log(`Starting HMR tests for ${phase} phase`);
    console.log(`\n🔄 Running HMR tests for ${phase} phase...`);

    try {
      // Test server component HMR
      await testServerComponentHmr(page, targetDir, phase, environment, bail);

      // Test client component HMR if client tests aren't skipped
      if (!skipClient) {
        await testClientComponentHmr(page, targetDir, phase, environment, bail);
      }
    } catch (error) {
      hasFailures = true;
      hmrTestError = error instanceof Error ? error : new Error(String(error));
      log("Error during HMR tests: %O", error);
      console.error(`❌ HMR tests failed: ${hmrTestError.message}`);

      // If bail is true, stop the tests
      if (bail) {
        throw error;
      }
    }
  } else {
    log(
      "Skipping HMR tests - targetDir not provided or skipHmr is true or not in Development environment",
    );
    if (skipHmr) {
      console.log("⏩ Skipping HMR tests as requested");
    } else if (!targetDir) {
      console.log("⏩ Skipping HMR tests - target directory not provided");
    } else if (environment !== "Development") {
      console.log(
        `⏩ Skipping HMR tests - not applicable in ${environment} environment`,
      );
    }

    // Update test status for HMR tests as skipped
    const env = environment === "Development" ? "dev" : "production";
    updateTestStatus(
      env,
      phase === "Initial" ? "initialServerHmr" : "realtimeServerHmr",
      "SKIPPED",
    );
    updateTestStatus(
      env,
      phase === "Initial" ? "initialClientHmr" : "realtimeClientHmr",
      "SKIPPED",
    );
  }

  // If there were failures, propagate them
  if (hasFailures) {
    // Combine errors
    const errors = [];
    if (initialServerTestError) {
      errors.push(`Initial server test: ${initialServerTestError.message}`);
    }
    if (clientTestError) {
      errors.push(`Client test: ${clientTestError.message}`);
    }
    if (serverRenderCheckError) {
      errors.push(`Server render check: ${serverRenderCheckError.message}`);
    }
    if (hmrTestError) {
      errors.push(`HMR test: ${hmrTestError.message}`);
    }
    if (stylesheetTestError) {
      errors.push(`Stylesheet test: ${stylesheetTestError.message}`);
    }

    throw new Error(`Multiple test failures: ${errors.join(", ")}`);
  }

  log("URL smoke test completed successfully");
}

/**
 * Check server-side smoke test status
 */
export async function checkServerSmoke(
  page: Page,
  phase: string = "",
  environment: string = "Development",
  bail: boolean = false,
  expectedTimestamp?: number,
  isServerRenderCheck: boolean = false,
): Promise<SmokeTestResult> {
  const checkType = isServerRenderCheck
    ? "Server Render Check"
    : "Initial Check";
  console.log(
    `🔍 Testing server-side smoke test ${phase ? `(${phase})` : ""} - ${checkType}`,
  );

  // Determine the environment and test key for state update
  const env = environment === "Development" ? "dev" : "production";

  // Determine the appropriate test key based on phase and whether this is a server render check
  let testKey: string;

  if (isServerRenderCheck) {
    // This is a server render check - use the appropriate key based on phase
    testKey =
      phase === "Initial" || !phase
        ? "initialServerRenderCheck"
        : "realtimeServerRenderCheck";
  } else {
    // Regular server-side check
    testKey =
      phase === "Initial" || !phase
        ? "initialServerSide"
        : "realtimeServerSide";
  }

  const result = await page.evaluate(async (expectedTimestamp) => {
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

      const timestamp = parseInt(
        smokeElement.getAttribute("data-timestamp") || "0",
        10,
      );
      const serverTimestamp = parseInt(
        smokeElement.getAttribute("data-server-timestamp") || "0",
        10,
      );

      // If an expected timestamp is provided, verify it matches
      let verificationPassed = true;
      let verificationError;

      if (expectedTimestamp) {
        verificationPassed = timestamp === expectedTimestamp;
        if (!verificationPassed) {
          verificationError = `Server timestamp (${timestamp}) does not match expected (${expectedTimestamp})`;
        }
      }

      return {
        status: status || "error",
        verificationPassed: status === "ok" && verificationPassed,
        timestamp,
        serverTimestamp,
        error:
          verificationError ||
          (status !== "ok" ? "Smoke test did not return ok status" : undefined),
      };
    } catch (error) {
      return {
        status: "error",
        verificationPassed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, expectedTimestamp);

  log("Server-side smoke test result: %O", result);

  // Update test status based on result
  updateTestStatus(
    env,
    testKey as keyof TestStatus[typeof env],
    result.verificationPassed ? "PASSED" : "FAILED",
  );

  // Report the result (this no longer throws errors)
  reportSmokeTestResult(
    result,
    isServerRenderCheck ? "Server Render Check" : "Server-side",
    phase,
    environment,
  );

  // Handle the error if verification failed
  if (!result.verificationPassed) {
    const errorMessage = `${environment} - ${phase ? `(${phase}) ` : ""}${isServerRenderCheck ? "Server Render Check" : "Server-side smoke test"} failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`;

    if (bail) {
      // If bail is true, call fail() which will exit the process
      await fail(
        new Error(errorMessage),
        1,
        `${environment} - ${isServerRenderCheck ? "Server Render Check" : "Server-side Smoke Test"} (${phase})`,
      );
    } else {
      // Otherwise throw an error that can be caught by the caller
      throw new Error(errorMessage);
    }
  }

  return result;
}

/**
 * Check client-side smoke test if refresh button is available
 */
export async function checkClientSmoke(
  page: Page,
  phase: string = "",
  environment: string = "Development",
  bail: boolean = false,
): Promise<SmokeTestResult | null> {
  console.log(`🔍 Testing client-side smoke test ${phase ? `(${phase})` : ""}`);

  // Determine the environment and test key for state update
  const env = environment === "Development" ? "dev" : "production";
  const testKey =
    phase === "Initial" || !phase ? "initialClientSide" : "realtimeClientSide";

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

      // Check if required client attributes exist
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

  // Update test status based on result
  updateTestStatus(
    env,
    testKey,
    result.verificationPassed ? "PASSED" : "FAILED",
  );

  // Report the result (this no longer throws errors)
  reportSmokeTestResult(result, "Client-side", phase, environment);

  // Handle the error if verification failed
  if (!result.verificationPassed) {
    const errorMessage = `${environment} - ${phase ? `(${phase}) ` : ""}Client-side smoke test failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`;

    if (bail) {
      // If bail is true, call fail() which will exit the process
      await fail(
        new Error(errorMessage),
        1,
        `${environment} - Client-side Smoke Test (${phase})`,
      );
    } else {
      // Otherwise throw an error that can be caught by the caller
      throw new Error(errorMessage);
    }
  }

  return result;
}

/**
 * Upgrade to realtime mode
 */
export async function upgradeToRealtime(
  page: Page,
  environment: string = "Development", // Add environment parameter with default
  bail: boolean = false, // Add bail parameter
): Promise<void> {
  console.log("\n📡 Upgrading to realtime mode");

  // Determine the environment for state update
  const env = environment === "Development" ? "dev" : "production";

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
    const errorMessage = `Failed to upgrade to realtime mode: ${upgradeResult.message}`;

    // Update test status to FAILED
    updateTestStatus(env, "realtimeUpgrade", "FAILED");

    if (bail) {
      // If bail is true, call fail() which will exit the process
      await fail(
        new Error(errorMessage),
        1,
        `${environment} - Realtime Upgrade`,
      );
      return; // This will never be reached due to fail() exiting
    } else {
      // Otherwise throw an error that can be caught by the caller
      throw new Error(errorMessage);
    }
  }

  // Update test status to PASSED
  updateTestStatus(env, "realtimeUpgrade", "PASSED");

  console.log("✅ Successfully upgraded to realtime mode");
}

/**
 * DRY: checkServerUp now checks both root and custom path if needed
 */
export async function checkServerUp(
  baseUrl: string,
  customPath: string = "/",
  retries = RETRIES,
  bail: boolean = false, // Add bail parameter
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

          const errorMessage = `Server at ${url} did not become available after ${retries} attempts`;

          if (bail) {
            // If bail is true, call fail() which will exit the process
            await fail(
              new Error(errorMessage),
              1,
              `Server Availability Check: ${url}`,
            );
            return false; // This will never be reached due to fail() exiting
          } else {
            // Otherwise throw an error that can be caught by the caller
            throw new Error(errorMessage);
          }
        }
        log("Server not up yet, retrying in 2 seconds");
        console.log(`Server not up yet, retrying in 2 seconds...`);
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 2000));
      }
    }
    if (!up) return false;
  }
  return true;
}

/**
 * Perform only the realtime upgrade and tests without doing initial checks
 */
async function realtimeOnlyFlow(
  page: Page,
  url: string,
  artifactDir: string,
  bail: boolean,
  skipClient: boolean,
  environment: string,
  targetDir?: string,
  skipHmr: boolean = false,
): Promise<{ hasFailures: boolean; error: Error | null }> {
  let hasFailures = false;
  let realtimeError: Error | null = null;

  // Create timestamp state for the realtime-only flow
  const timestampState = {
    initialServerValue: 23, // This is the default initial module-level value
    clientUpdatedValue: null as number | null,
  };

  try {
    log("Performing realtime-only smoke test");
    await checkUrlSmoke(
      page,
      url,
      true,
      bail,
      skipClient,
      environment,
      timestampState,
      targetDir,
      skipHmr,
    );

    // Take a screenshot of the realtime test
    await takeScreenshot(
      page,
      url,
      artifactDir,
      `${environment.toLowerCase()}-realtime-passed`,
    );
  } catch (error) {
    hasFailures = true;
    realtimeError = error instanceof Error ? error : new Error(String(error));
    log("Error during realtime-only test: %O", error);
    console.error(`❌ Realtime test failed: ${realtimeError.message}`);

    // Take a failure screenshot
    await takeScreenshot(
      page,
      url,
      artifactDir,
      `${environment.toLowerCase()}-realtime-failed`,
    ).catch((e) => log("Failed to take error screenshot: %O", e));

    // If bail is true, propagate the error
    if (bail) {
      throw error;
    }
  }

  return { hasFailures, error: realtimeError };
}

/**
 * HMR test for server component
 * Updates the server component and verifies that HMR applies the changes
 */
export async function testServerComponentHmr(
  page: Page,
  targetDir: string,
  phase: string = "",
  environment: string = "Development",
  bail: boolean = false,
): Promise<boolean> {
  const testPhase = phase ? phase : "Initial";

  // Skip HMR tests in production environments
  if (environment !== "Development") {
    console.log(`⏩ Skipping server HMR test in ${environment} environment`);

    // Update test status to SKIPPED
    const env = environment === "Development" ? "dev" : "production";
    const testKey =
      testPhase === "Initial" || !testPhase
        ? "initialServerHmr"
        : "realtimeServerHmr";
    updateTestStatus(env, testKey as keyof TestStatus[typeof env], "SKIPPED");

    return false;
  }

  console.log(`🔄 Testing ${testPhase} Server Component HMR`);

  // Determine the environment and test key for state update
  const env = environment === "Development" ? "dev" : "production";
  const testKey =
    testPhase === "Initial" || !testPhase
      ? "initialServerHmr"
      : "realtimeServerHmr";

  try {
    // First, verify the server HMR marker exists
    log("Checking for server HMR marker");
    const markerExists = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="server-hmr-marker"]',
      );
      return !!marker;
    });

    if (!markerExists) {
      log("Server HMR marker not found");
      console.warn(
        "⚠️ Server HMR marker not found in the page - skipping server HMR test",
      );
      updateTestStatus(env, testKey as keyof TestStatus[typeof env], "SKIPPED");
      return false;
    }

    // Get the initial attributes before making changes
    const initialAttributes = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="server-hmr-marker"]',
      );
      if (!marker) return null;
      return {
        text: marker.getAttribute("data-hmr-text"),
        timestamp: marker.getAttribute("data-hmr-timestamp"),
        content: marker.textContent,
      };
    });

    log("Initial server HMR marker state: %O", initialAttributes);

    // Find the SmokeTest.tsx file path
    const smokePath = join(
      targetDir,
      "src",
      "app",
      "components",
      "__SmokeTest.tsx",
    );
    log("Looking for smoke test file at: %s", smokePath);

    // Read the current file content
    const fs = await import("fs/promises");
    const fileContent = await fs.readFile(smokePath, "utf-8");

    // Define the new content with updated HMR marker
    const newTimestamp = Date.now();
    const updatedContent = fileContent
      .replace(
        /data-hmr-text="[^"]*"/g,
        `data-hmr-text="updated-${newTimestamp}"`,
      )
      .replace(
        /data-hmr-timestamp=\{[^}]*\}/g,
        `data-hmr-timestamp={${newTimestamp}}`,
      )
      .replace(
        /Server Component HMR: <span>[^<]*<\/span>/g,
        `Server Component HMR: <span>Updated Text ${newTimestamp}</span>`,
      );

    // Write the updated file
    log("Writing updated server component content");
    await fs.writeFile(smokePath, updatedContent, "utf-8");

    // Wait for HMR to apply changes
    console.log("Waiting for server HMR to update component...");

    // Wait for the data-hmr-text attribute to change
    log("Waiting for server HMR update to apply");
    try {
      await page.waitForFunction(
        (timestamp) => {
          const marker = document.querySelector(
            '[data-testid="server-hmr-marker"]',
          );
          if (!marker) return false;
          const currentText = marker.getAttribute("data-hmr-text");
          return (
            currentText &&
            currentText.includes("updated-") &&
            currentText.includes(timestamp)
          );
        },
        { timeout: 10000 },
        newTimestamp.toString(),
      );
      log("Server HMR update detected");
    } catch (error) {
      log("ERROR: Server HMR update not detected: %O", error);
      updateTestStatus(env, testKey as keyof TestStatus[typeof env], "FAILED");

      if (bail) {
        await fail(
          new Error(
            `Server HMR test failed: Update not detected within timeout`,
          ),
          1,
          `${environment} - Server HMR Test (${testPhase})`,
        );
      }
      return false;
    }

    // Verify final state
    const updatedAttributes = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="server-hmr-marker"]',
      );
      if (!marker) return null;
      return {
        text: marker.getAttribute("data-hmr-text"),
        timestamp: marker.getAttribute("data-hmr-timestamp"),
        content: marker.textContent,
      };
    });

    log("Updated server HMR marker state: %O", updatedAttributes);

    const hmrSuccess =
      updatedAttributes &&
      updatedAttributes.text &&
      updatedAttributes.text.includes("updated-");

    updateTestStatus(
      env,
      testKey as keyof TestStatus[typeof env],
      hmrSuccess ? "PASSED" : "FAILED",
    );

    if (hmrSuccess) {
      console.log("✅ Server component HMR test passed");
      return true;
    } else {
      console.error(
        "❌ Server component HMR test failed: Content did not update properly",
      );

      if (bail) {
        await fail(
          new Error(`Server HMR test failed: Content did not update properly`),
          1,
          `${environment} - Server HMR Test (${testPhase})`,
        );
      }
      return false;
    }
  } catch (error) {
    log("Error during server HMR test: %O", error);
    console.error(
      `❌ Server HMR test failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    updateTestStatus(env, testKey as keyof TestStatus[typeof env], "FAILED");

    if (bail) {
      await fail(
        error instanceof Error ? error : new Error(String(error)),
        1,
        `${environment} - Server HMR Test (${testPhase})`,
      );
    }
    return false;
  }
}

/**
 * HMR test for client component
 * Updates the client component and verifies that HMR applies the changes
 */
export async function testClientComponentHmr(
  page: Page,
  targetDir: string,
  phase: string = "",
  environment: string = "Development",
  bail: boolean = false,
): Promise<boolean> {
  const testPhase = phase ? phase : "Initial";

  // Skip HMR tests in production environments
  if (environment !== "Development") {
    console.log(`⏩ Skipping client HMR test in ${environment} environment`);

    // Update test status to SKIPPED
    const env = environment === "Development" ? "dev" : "production";
    const testKey =
      testPhase === "Initial" || !testPhase
        ? "initialClientHmr"
        : "realtimeClientHmr";
    updateTestStatus(env, testKey as keyof TestStatus[typeof env], "SKIPPED");

    return false;
  }

  console.log(`🔄 Testing ${testPhase} Client Component HMR`);

  // Determine the environment and test key for state update
  const env = environment === "Development" ? "dev" : "production";
  const testKey =
    testPhase === "Initial" || !testPhase
      ? "initialClientHmr"
      : "realtimeClientHmr";

  try {
    // First, verify the client HMR marker exists
    log("Checking for client HMR marker");
    const markerExists = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="client-hmr-marker"]',
      );
      return !!marker;
    });

    if (!markerExists) {
      log("Client HMR marker not found");
      console.warn(
        "⚠️ Client HMR marker not found in the page - skipping client HMR test",
      );
      updateTestStatus(env, testKey as keyof TestStatus[typeof env], "SKIPPED");
      return false;
    }

    // Get the initial attributes before making changes
    const initialAttributes = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="client-hmr-marker"]',
      );
      if (!marker) return null;
      return {
        text: marker.getAttribute("data-hmr-text"),
        timestamp: marker.getAttribute("data-hmr-timestamp"),
        content: marker.textContent,
      };
    });

    log("Initial client HMR marker state: %O", initialAttributes);

    // Find the SmokeTestClient.tsx file path
    const clientPath = join(
      targetDir,
      "src",
      "app",
      "components",
      "__SmokeTestClient.tsx",
    );
    log("Looking for client component file at: %s", clientPath);

    // Read the current file content
    const fs = await import("fs/promises");
    const fileContent = await fs.readFile(clientPath, "utf-8");

    // Define the new content with updated HMR marker
    const newTimestamp = Date.now();
    const updatedContent = fileContent
      .replace(
        /data-hmr-text="[^"]*"/g,
        `data-hmr-text="updated-${newTimestamp}"`,
      )
      .replace(
        /data-hmr-timestamp=\{[^}]*\}/g,
        `data-hmr-timestamp={${newTimestamp}}`,
      )
      .replace(
        /Client Component HMR: <span>[^<]*<\/span>/g,
        `Client Component HMR: <span>Updated Text ${newTimestamp}</span>`,
      );

    // Write the updated file
    log("Writing updated client component content");
    await fs.writeFile(clientPath, updatedContent, "utf-8");

    // Wait for HMR to apply changes
    console.log("Waiting for client HMR to update component...");

    // Wait for the data-hmr-text attribute to change
    log("Waiting for client HMR update to apply");
    try {
      await page.waitForFunction(
        (timestamp) => {
          const marker = document.querySelector(
            '[data-testid="client-hmr-marker"]',
          );
          if (!marker) return false;
          const currentText = marker.getAttribute("data-hmr-text");
          return (
            currentText &&
            currentText.includes("updated-") &&
            currentText.includes(timestamp)
          );
        },
        { timeout: 10000 },
        newTimestamp.toString(),
      );
      log("Client HMR update detected");
    } catch (error) {
      log("ERROR: Client HMR update not detected: %O", error);
      updateTestStatus(env, testKey as keyof TestStatus[typeof env], "FAILED");

      if (bail) {
        await fail(
          new Error(
            `Client HMR test failed: Update not detected within timeout`,
          ),
          1,
          `${environment} - Client HMR Test (${testPhase})`,
        );
      }
      return false;
    }

    // Verify final state
    const updatedAttributes = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="client-hmr-marker"]',
      );
      if (!marker) return null;
      return {
        text: marker.getAttribute("data-hmr-text"),
        timestamp: marker.getAttribute("data-hmr-timestamp"),
        content: marker.textContent,
      };
    });

    log("Updated client HMR marker state: %O", updatedAttributes);

    const hmrSuccess =
      updatedAttributes &&
      updatedAttributes.text &&
      updatedAttributes.text.includes("updated-");

    updateTestStatus(
      env,
      testKey as keyof TestStatus[typeof env],
      hmrSuccess ? "PASSED" : "FAILED",
    );

    if (hmrSuccess) {
      console.log("✅ Client component HMR test passed");
      return true;
    } else {
      console.error(
        "❌ Client component HMR test failed: Content did not update properly",
      );

      if (bail) {
        await fail(
          new Error(`Client HMR test failed: Content did not update properly`),
          1,
          `${environment} - Client HMR Test (${testPhase})`,
        );
      }
      return false;
    }
  } catch (error) {
    log("Error during client HMR test: %O", error);
    console.error(
      `❌ Client HMR test failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    updateTestStatus(env, testKey as keyof TestStatus[typeof env], "FAILED");

    if (bail) {
      await fail(
        error instanceof Error ? error : new Error(String(error)),
        1,
        `${environment} - Client HMR Test (${testPhase})`,
      );
    }
    return false;
  }
}
