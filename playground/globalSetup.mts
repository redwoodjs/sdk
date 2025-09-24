import { launchBrowser, type Browser } from "rwsdk/e2e";
import fs from "fs-extra";
import os from "os";
import path from "path";

const tempDir = path.join(os.tmpdir(), "rwsdk-e2e-tests");
const wsEndpointFile = path.join(tempDir, "wsEndpoint");

let browser: Browser | null = null;

export async function setup() {
  await fs.ensureDir(tempDir);
  browser = await launchBrowser();
  await fs.writeFile(wsEndpointFile, browser.wsEndpoint());
}

export async function teardown() {
  if (browser) {
    await browser.close();
  }
  await fs.remove(tempDir);
}
