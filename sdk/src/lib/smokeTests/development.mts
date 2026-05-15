import { runDevServer as runE2EDevServer } from "../../lib/e2e/dev.mjs";
import { checkServerUp, checkUrl, launchBrowser } from "./browser.mjs";
import { log, RETRIES } from "./constants.mjs";
import { state } from "./state.mjs";

/**
 * Run the local development server and return the URL
 */
export async function runDevServer(cwd?: string): Promise<{
  url: string;
  stopDev: () => Promise<void>;
}> {
  return runE2EDevServer(state.options.packageManager, cwd);
}

/**
 * Runs tests against the development server
 */
export async function runDevTest(
  url: string,
  artifactDir: string,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
  realtime: boolean = false,
  skipHmr: boolean = false,
  skipStyleTests: boolean = false,
): Promise<void> {
  log("Starting dev server test");
  console.log("🚀 Testing local development server");

  const browser = await launchBrowser(browserPath, headless);
  const page = await browser.newPage();

  try {
    const testUrl = new URL("/__smoke_test", url).toString();
    // DRY: check both root and custom path
    await checkServerUp(url, "/", RETRIES, bail);

    // Pass the target directory to checkUrl for HMR testing
    const targetDir = state.resources.targetDir;

    await page.goto(testUrl, { waitUntil: "networkidle0" });

    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
      "Development", // Add environment context parameter
      realtime, // Add realtime parameter
      targetDir, // Add target directory for HMR testing
      skipHmr, // Add skip HMR option
      skipStyleTests, // Add skip style tests option
    );

    log("Development server test completed successfully");
  } catch (error) {
    // Add more context about the specific part that failed
    if (error instanceof Error && error.message.includes("Server at")) {
      state.failures.push({
        step: "Development - Server Availability",
        error: error.message,
        details: error.stack,
      });
    }
    log("Error during development server testing: %O", error);
    // Make sure we throw the error so it's properly handled upstream
    throw error;
  } finally {
    await browser.close();
  }
}
