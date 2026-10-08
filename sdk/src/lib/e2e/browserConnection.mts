import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import { closeBrowser, launchBrowser } from "./browser.mjs";
import { ensureTmpDir } from "./utils.mjs";
import { recordDiagnostic } from "./diagnostics.mjs";

export async function getBrowserEndpointPath(): Promise<string> {
  return path.join(await ensureTmpDir(), "rwsdk-e2e-tests", "wsEndpoint");
}

export interface BrowserConnection {
  browser: Browser;
  release: () => Promise<void>;
}

export async function acquireBrowser(
  endpointPath?: string,
): Promise<BrowserConnection> {
  const filePath = endpointPath ?? (await getBrowserEndpointPath());
  recordDiagnostic("browser.connect.start", { endpointPath: filePath });
  try {
    const endpoint = await readFile(filePath, "utf8");
    const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    recordDiagnostic("browser.connect.end");
    return {
      browser,
      release: async () => {
        recordDiagnostic("browser.disconnect.start");
        await browser.disconnect();
        recordDiagnostic("browser.disconnect.end");
      },
    };
  } catch (error) {
    console.warn(
      "Unable to connect to the shared test browser; launching a local browser.",
      error instanceof Error ? error.message : String(error),
    );
  }

  const headless =
    process.env.RWSDK_HEADLESS === undefined ||
    process.env.RWSDK_HEADLESS === "1" ||
    process.env.RWSDK_HEADLESS === "true";
  recordDiagnostic("browser.launch.start");
  const browser = await launchBrowser(undefined, headless);
  recordDiagnostic("browser.launch.end", { pid: browser.process()?.pid });
  return {
    browser,
    release: async () => {
      recordDiagnostic("browser.close.start");
      await closeBrowser(browser);
      recordDiagnostic("browser.close.end");
    },
  };
}
