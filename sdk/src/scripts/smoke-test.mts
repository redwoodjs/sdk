import { $ } from "../lib/$.mjs";
import puppeteer from "puppeteer-core";
import { setTimeout } from "node:timers/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";
import * as process from "process";
import {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
} from "@puppeteer/browsers";

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || "localhost";
const URL = `http://${HOST}:${PORT}`;
const TIMEOUT = 30000; // 30 seconds timeout
const RETRIES = 3;

interface HealthCheckResult {
  status: string;
  verificationPassed: boolean;
  timestamp?: number;
  rawResult?: unknown;
  error?: string;
}

// Define the expected health check response type
interface HealthCheckResponse {
  status: string;
  timestamp?: number;
  [key: string]: unknown;
}

async function runSmokeTest() {
  console.log(`🧪 Running smoke tests against ${URL}`);

  // First check if server is up
  let isServerUp = false;
  for (let i = 0; i < RETRIES; i++) {
    try {
      console.log(`Checking if server is up (attempt ${i + 1}/${RETRIES})...`);
      await $`curl -s -o /dev/null -w "%{http_code}" ${URL}`;
      isServerUp = true;
      break;
    } catch (error) {
      console.log(`Server not up yet, retrying in 2 seconds...`);
      await setTimeout(2000);
    }
  }

  if (!isServerUp) {
    console.error(`❌ Failed to connect to server at ${URL}`);
    process.exit(1);
  }

  // Get browser path - use the puppeteer browsers API
  let browserPath: string;
  try {
    console.log("Finding Chrome executable...");
    // First try using environment variable if set
    if (process.env.CHROME_PATH) {
      browserPath = process.env.CHROME_PATH;
      console.log(`Using Chrome from environment variable: ${browserPath}`);
    } else {
      // Use puppeteer's programmatic API
      console.log("Using @puppeteer/browsers API to find or install Chrome...");

      // Detect platform
      const platform = detectBrowserPlatform();
      if (!platform) {
        throw new Error("Failed to detect browser platform");
      }

      try {
        // Try to compute the path first (this will check if it's installed)
        browserPath = computeExecutablePath({
          browser: "chrome",
          channel: "stable",
          platform,
        });
        console.log(`Found existing Chrome at: ${browserPath}`);
      } catch (error) {
        // If path computation fails, install Chrome
        console.log("No Chrome installation found. Installing Chrome...");
        await install({
          browser: "chrome",
          channel: "stable",
          platform,
        });

        // Now compute the path for the installed browser
        browserPath = computeExecutablePath({
          browser: "chrome",
          channel: "stable",
          platform,
        });
        console.log(`Installed and using Chrome at: ${browserPath}`);
      }
    }
  } catch (error) {
    console.error("❌ Failed to find Chrome executable:", error);
    process.exit(1);
  }

  console.log(`🚀 Launching browser from ${browserPath}`);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set a timeout for the navigation
    page.setDefaultNavigationTimeout(TIMEOUT);

    // Test only using query param on the main page
    console.log(`🔍 Testing health check with query param: ${URL}/?__health`);
    await page.goto(`${URL}/?__health`, { waitUntil: "networkidle0" });

    // Check if __rsc_callServer is available and directly call the health check
    const healthCheckResult = await page.evaluate(async () => {
      // Check if __rsc_callServer is available
      if (typeof globalThis.__rsc_callServer !== "function") {
        return {
          status: "error",
          verificationPassed: false,
          error: "__rsc_callServer is not available",
        };
      }

      try {
        const timestamp = Date.now();
        // Directly call the server action
        const result = await globalThis.__rsc_callServer("__health", [
          timestamp,
        ]);

        // Check the result
        let status = "error";
        let verificationPassed = false;

        if (typeof result === "object" && result !== null) {
          const typedResult = result as HealthCheckResponse;
          status = typedResult.status || "error";
          verificationPassed = typedResult.timestamp === timestamp;
        } else if (result === "ok") {
          status = "ok";
          verificationPassed = true;
        }

        return {
          status,
          verificationPassed,
          timestamp,
          rawResult: result,
        };
      } catch (error) {
        return {
          status: "error",
          verificationPassed: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    if (
      healthCheckResult.status === "ok" &&
      healthCheckResult.verificationPassed
    ) {
      console.log("✅ Health check passed! Server is healthy.");
      console.log(
        `✅ Timestamp verification passed for timestamp: ${healthCheckResult.timestamp}`
      );
    } else {
      console.error(
        `❌ Health check failed. Status: ${healthCheckResult.status}`
      );
      console.error(
        `❌ Timestamp verification: ${
          healthCheckResult.verificationPassed ? "passed" : "failed"
        }`
      );
      if (healthCheckResult.error) {
        console.error(`❌ Error: ${healthCheckResult.error}`);
      }
      process.exit(1);
    }

    // Take a screenshot for CI artifacts if needed
    await page.screenshot({ path: "smoke-test-result.png" });
  } catch (error) {
    console.error("❌ Smoke test failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log("✨ All smoke tests completed successfully!");
}

// Run the smoke test if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runSmokeTest().catch((error) => {
    console.error("❌ Unhandled error in smoke test:", error);
    process.exit(1);
  });
}

export { runSmokeTest };
