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
  environment: string = "Development", // Add environment parameter with default
  realtime: boolean = false, // Add realtime parameter with default
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
        await checkUrlSmoke(page, url, true, bail, skipClient, environment);

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
        await checkUrlSmoke(page, url, false, bail, skipClient, environment);
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
        log("Reloading page after realtime upgrade");
        await page.reload({ waitUntil: "networkidle0" });
        log("Performing post-upgrade smoke test");
        await checkUrlSmoke(page, url, true, bail, skipClient, environment);
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
  environment: string = "Development", // Add environment parameter with default
): Promise<void> {
  // Determine the phase for clearer logging and status reporting
  let phase: string;
  if (isRealtime) {
    // If using --realtime flag, show as "Realtime", otherwise as "Post-upgrade"
    const realtimeFlag = process.argv.includes("--realtime");
    phase = realtimeFlag ? "Realtime" : "Post-upgrade";
  } else {
    phase = "Initial";
  }

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
  let clientToServerTestError: Error | null = null;
  let clientTimestamp: number = 0;

  // Determine the environment for status update
  const env = environment === "Development" ? "dev" : "production";

  // 1. Run initial server-side smoke test
  log("Running initial server-side smoke test");
  try {
    // For the initial phase, check default value (23); for realtime phases, don't expect a specific value yet
    const expectedTimestamp = phase === "Initial" ? 23 : undefined;
    const initialResult = await checkServerSmoke(
      page,
      phase,
      environment,
      bail,
      expectedTimestamp,
    );
    log(`Server stored timestamp: ${initialResult.serverStoredTimestamp}`);
  } catch (error) {
    hasFailures = true;
    serverTestError = error instanceof Error ? error : new Error(String(error));
    log("Error during server-side smoke test: %O", error);
    console.error(
      `❌ Server-side smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    // If bail is true, stop the tests
    if (bail) {
      throw error;
    }

    console.log(
      "Continuing with client-side smoke test since --bail is not enabled...",
    );
  }

  // 2. Run client-side smoke test if available and not skipped
  if (!skipClient && !serverTestError) {
    log("Running client-side smoke test");
    try {
      const clientResult = await checkClientSmoke(
        page,
        phase,
        environment,
        bail,
      );
      if (clientResult && clientResult.clientTimestamp) {
        clientTimestamp = clientResult.clientTimestamp;
        log(`Client timestamp from test: ${clientTimestamp}`);
      }

      // Always perform server rerender test in all cases (initial, post-upgrade, and realtime-only)
      // 3. Update server state using the client-side update button
      log("Clicking update server timestamp button");
      console.log("Clicking the 'Update Server Timestamp' button...");
      await page.click('[data-testid="update-server-timestamp"]');

      // Wait for update to complete
      await page.waitForFunction(
        () => {
          const element = document.querySelector(
            "#smoke-test-client-timestamp",
          );
          return (
            element &&
            element.getAttribute("data-server-update-timestamp") !== ""
          );
        },
        { timeout: 5000 },
      );

      // Get the timestamp that was sent to server
      clientTimestamp = await page.evaluate(() => {
        const element = document.querySelector("#smoke-test-client-timestamp");
        return element
          ? parseInt(
              element.getAttribute("data-server-update-timestamp") || "0",
              10,
            )
          : 0;
      });

      log(`Client sent timestamp to server: ${clientTimestamp}`);
      console.log(`Client set timestamp to: ${clientTimestamp}`);

      // 4. Reload page to check if server state was updated
      log("Reloading page to check server state update");
      console.log("Reloading page to check if server state was updated...");
      await page.reload();
      await page.waitForSelector('[data-testid="health-status"]');

      // 5. Check server state again with the client timestamp to verify update
      log("Checking server state after client update");
      await checkServerSmoke(
        page,
        "After Client Update",
        environment,
        bail,
        clientTimestamp,
      );

      // If we got here, update the status
      updateTestStatus(env, "serverRerender", "PASSED");
      console.log(
        `✅ Server rerender test passed${isRealtime ? " in realtime mode" : ""}!`,
      );
    } catch (error: unknown) {
      hasFailures = true;

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.includes("Client-to-server")
      ) {
        clientToServerTestError =
          error instanceof Error ? error : new Error(String(error));
        updateTestStatus(env, "serverRerender", "FAILED");
      } else {
        clientTestError =
          error instanceof Error ? error : new Error(String(error));
        log("Error during client-side smoke test: %O", error);
        console.error(
          `❌ Client-side smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // If bail is true, stop the tests
      if (bail) {
        throw error;
      }
    }
  } else {
    log("Skipping client-side smoke test");
    console.log("⏩ Skipping client-side smoke test as requested");
    // Skip client-to-server test too
    updateTestStatus(env, "serverRerender", "SKIPPED");
  }

  // If there were failures, propagate them
  if (hasFailures) {
    // Combine errors or just throw the one that happened
    const errors: string[] = [];
    if (serverTestError)
      errors.push(`Server-side test: ${serverTestError.message}`);
    if (clientTestError)
      errors.push(`Client-side test: ${clientTestError.message}`);
    if (clientToServerTestError)
      errors.push(`Client-to-server test: ${clientToServerTestError.message}`);

    throw new Error(`Test failures: ${errors.join(", ")}`);
  }

  log("URL smoke test completed successfully");
}

/**
 * Check server-side smoke test status
 */
export async function checkServerSmoke(
  page: Page,
  phase: string = "",
  environment: string = "Development", // Add environment parameter with default
  bail: boolean = false, // Add bail parameter
  expectedTimestamp?: number, // Parameter for expected timestamp (default or from client)
): Promise<SmokeTestResult & { serverStoredTimestamp?: number }> {
  console.log(`🔍 Testing server-side smoke test ${phase ? `(${phase})` : ""}`);

  // Determine the environment and test key for state update
  const env = environment === "Development" ? "dev" : "production";
  const testKey =
    phase === "Initial" || !phase ? "initialServerSide" : "realtimeServerSide";

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
      const serverStoredTimestamp = parseInt(
        smokeElement.getAttribute("data-server-stored-timestamp") || "0",
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
        serverStoredTimestamp,
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

  // Check if a specific server-stored timestamp is expected
  if (expectedTimestamp !== undefined) {
    // For the initial check, we expect the default value (23)
    if (phase === "Initial" && expectedTimestamp === 23) {
      const defaultExpected = 23;
      if (result.serverStoredTimestamp !== defaultExpected) {
        result.verificationPassed = false;
        result.error = `Server-stored timestamp does not match default value. Expected: ${defaultExpected}, got: ${result.serverStoredTimestamp}`;
      } else {
        console.log(
          `✅ Server has default timestamp value: ${result.serverStoredTimestamp}`,
        );
      }
    }
    // After client update, the timestamp should match what client sent
    else if (phase === "After Client Update") {
      if (result.serverStoredTimestamp !== expectedTimestamp) {
        result.verificationPassed = false;
        result.error = `Server-stored timestamp was not updated by client action. Expected: ${expectedTimestamp}, got: ${result.serverStoredTimestamp}`;
        // Update the serverRerender status
        updateTestStatus(env, "serverRerender", "FAILED");
      } else {
        console.log(
          `✅ Server-stored timestamp was successfully updated by client action to: ${result.serverStoredTimestamp}`,
        );
        // Update the serverRerender status
        updateTestStatus(env, "serverRerender", "PASSED");
      }
    }
  }

  // Update test status based on result
  updateTestStatus(
    env,
    testKey,
    result.verificationPassed ? "PASSED" : "FAILED",
  );

  // Report the result (this no longer throws errors)
  reportSmokeTestResult(result, "Server-side", phase, environment);

  // Handle the error if verification failed
  if (!result.verificationPassed) {
    const errorMessage = `${environment} - ${phase ? `(${phase}) ` : ""}Server-side smoke test failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`;

    if (bail) {
      // If bail is true, call fail() which will exit the process
      await fail(
        new Error(errorMessage),
        1,
        `${environment} - Server-side Smoke Test (${phase})`,
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
  environment: string = "Development", // Add environment parameter with default
  bail: boolean = false, // Add bail parameter
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
): Promise<{ hasFailures: boolean; error: Error | null }> {
  let hasFailures = false;
  let realtimeError: Error | null = null;

  try {
    // Directly upgrade to realtime mode
    console.log(
      "\n📡 Directly upgrading to realtime mode (skipping initial tests)",
    );
    await upgradeToRealtime(page, environment, bail);

    log("Reloading page after realtime upgrade");
    await page.reload({ waitUntil: "networkidle0" });

    log("Performing realtime-only smoke test");
    await checkUrlSmoke(page, url, true, bail, skipClient, environment);

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
