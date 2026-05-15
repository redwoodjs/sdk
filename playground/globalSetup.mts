import { launchBrowser, type Browser } from "rwsdk/e2e/setup";
import fs from "fs-extra";
import os from "os";
import path from "path";

const tempDir = path.join(os.tmpdir(), "rwsdk-e2e-tests");
const wsEndpointFile = path.join(tempDir, "wsEndpoint");

let browser: Browser | null = null;

export async function setup() {
  await fs.ensureDir(tempDir);
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
      await browser.close();
    } catch (error) {
      console.warn("Suppressing error during browser.close():", error);
    }
  }
  await fs.remove(tempDir);
}
