import {
  closeBrowser,
  getBrowserEndpointPath,
  launchBrowser,
  type Browser,
} from "rwsdk/e2e/setup";
import fs from "fs-extra";
import path from "path";

let wsEndpointFile: string;

let browser: Browser | null = null;

export async function setup() {
  wsEndpointFile = await getBrowserEndpointPath();
  await fs.ensureDir(path.dirname(wsEndpointFile));
  // Check for RWSDK_HEADLESS environment variable (default to true if not set)
  // Set RWSDK_HEADLESS=0 or RWSDK_HEADLESS=false to run in headed mode
  const headless =
    process.env.RWSDK_HEADLESS === undefined ||
    process.env.RWSDK_HEADLESS === "1" ||
    process.env.RWSDK_HEADLESS === "true";
  browser = await launchBrowser(undefined, headless);
  await fs.writeFile(wsEndpointFile, browser.wsEndpoint());
}

export async function teardown() {
  if (browser) {
    try {
      await closeBrowser(browser);
    } catch (error) {
      console.warn("Suppressing error during browser.close():", error);
    }
  }
  if (wsEndpointFile) {
    await fs.remove(wsEndpointFile);
  }
}
