import { $ } from "../lib/$.mjs";
import { computeSystemExecutablePath } from "@puppeteer/browsers";
import puppeteer from "puppeteer-core";
import { setTimeout } from "node:timers/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";
import * as process from "process";

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || "localhost";
const URL = `http://${HOST}:${PORT}`;
const TIMEOUT = 30000; // 30 seconds timeout
const RETRIES = 3;

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

  // Get browser path
  let browserPath: string;
  try {
    console.log("Finding Chromium executable...");
    browserPath = await computeSystemExecutablePath({
      browser: "chromium",
      buildId: "latest",
    });
  } catch (error) {
    console.error("❌ Failed to find Chromium. Installing Chromium...");
    try {
      await $`npx @puppeteer/browsers install chromium@latest`;
      browserPath = await computeSystemExecutablePath({
        browser: "chromium",
        buildId: "latest",
      });
    } catch (installError) {
      console.error("❌ Failed to install Chromium:", installError);
      process.exit(1);
    }
  }

  console.log(`🚀 Launching browser from ${browserPath}`);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set a timeout for the navigation
    page.setDefaultNavigationTimeout(TIMEOUT);

    // Navigate to the health check endpoint
    console.log(`🔍 Navigating to health check endpoint: ${URL}/__health`);
    await page.goto(`${URL}/__health`, { waitUntil: "networkidle0" });

    // Wait for the health check result to be available
    await page.waitForSelector("#health-check-result");

    // Get the health check result
    const healthCheckResult = await page.$eval(
      "#health-check-result",
      (el: Element) => el.getAttribute("data-result")
    );

    // Check if timestamp verification passed
    const timestampVerified = await page.$eval(
      "#health-check-result",
      (el: Element) => el.getAttribute("data-verified") === "true"
    );

    // Get the timestamp that was sent
    const timestamp = await page.$eval("#health-check-result", (el: Element) =>
      el.getAttribute("data-timestamp")
    );

    if (healthCheckResult === "ok" && timestampVerified) {
      console.log("✅ Health check passed! Server is healthy.");
      console.log(
        `✅ Timestamp verification passed for timestamp: ${timestamp}`
      );
    } else if (healthCheckResult === "ok" && !timestampVerified) {
      console.error(
        `⚠️ Health check passed but timestamp verification failed for: ${timestamp}`
      );
      process.exit(1);
    } else {
      console.error(`❌ Health check failed. Received: ${healthCheckResult}`);
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
