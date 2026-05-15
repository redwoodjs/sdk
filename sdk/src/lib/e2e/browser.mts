import {
  computeExecutablePath,
  detectBrowserPlatform,
  install,
  Browser as PuppeteerBrowser,
  resolveBuildId,
  type InstallOptions,
} from "@puppeteer/browsers";
import debug from "debug";
import { mkdirp, pathExists } from "fs-extra";
import { join } from "path";
import { chromium as playwrightChromium } from "playwright-core";
import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import { $ } from "../$.mjs";
import { SmokeTestOptions } from "./types.mjs";
import { ensureTmpDir } from "./utils.mjs";

const log = debug("rwsdk:e2e:browser");

/**
 * Launch a browser instance
 */
export async function launchBrowser(
  browserPath?: string,
  headless: boolean = true,
): Promise<Browser> {
  // Define a consistent cache directory path in system temp folder
  const rwCacheDir = join(await ensureTmpDir(), "redwoodjs-smoke-test-cache");
  await mkdirp(rwCacheDir);
  log("Using cache directory: %s", rwCacheDir);

  // Get browser path if not provided
  if (!browserPath) {
    log("Getting browser executable path");
    browserPath = await getBrowserPath({ headless });
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
 * Check if a server is up, trying localhost and loopback host variants.
 */
export async function checkServerUp(
  baseUrl: string,
  customPath: string = "/",
  retries = 30,
  includeRoot: boolean = true,
): Promise<string> {
  const pathsToCheck = includeRoot ? ["/"] : [];
  if (customPath !== "/" && customPath !== "") {
    pathsToCheck.push(customPath);
  }
  if (pathsToCheck.length === 0) {
    pathsToCheck.push("/");
  }

  for (const path of pathsToCheck) {
    const normalizedPath = path.startsWith("/") ? path : "/" + path;
    const baseUrlObject = new URL(baseUrl);
    const candidateBaseUrls = Array.from(
      new Set([
        baseUrl,
        `${baseUrlObject.protocol}//127.0.0.1:${baseUrlObject.port}`,
        `${baseUrlObject.protocol}//[::1]:${baseUrlObject.port}`,
      ]),
    );
    const candidateUrls = candidateBaseUrls.map(
      (candidateBaseUrl) => candidateBaseUrl + normalizedPath,
    );

    log(
      "Checking if server is up at %s (max retries: %d)",
      candidateUrls[0],
      retries,
    );

    for (let i = 0; i < retries; i++) {
      for (const candidateUrl of candidateUrls) {
        try {
          log(
            "Attempt %d/%d to check server at %s",
            i + 1,
            retries,
            candidateUrl,
          );
          console.log(
            `Checking if server is up at ${candidateUrl} (attempt ${i + 1}/${retries})...`,
          );
          await $`curl --max-time 1 -s -o /dev/null -w "%{http_code}" ${candidateUrl}`;
          log("Server is up at %s", candidateUrl);
          console.log(`✅ Server is up at ${candidateUrl}`);
          return candidateUrl;
        } catch {
          // Try the next host variant.
        }
      }

      if (i === retries - 1) {
        log(
          "ERROR: Server at %s did not become available after %d attempts",
          candidateUrls[0],
          retries,
        );
        throw new Error(
          `Server at ${candidateUrls[0]} did not become available after ${retries} attempts`,
        );
      }

      log("Server not up yet, retrying in 2 seconds");
      console.log(`Server not up yet, retrying in 2 seconds...`);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 2000));
    }
  }

  return "";
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

  try {
    const playwrightPath = playwrightChromium.executablePath();
    if (await pathExists(playwrightPath)) {
      console.log(`Found Playwright Chrome at: ${playwrightPath}`);
      return playwrightPath;
    }
  } catch (error) {
    log("Playwright browser path unavailable: %O", error);
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
  const rwCacheDir = join(await ensureTmpDir(), "redwoodjs-smoke-test-cache");
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

      const attempts = 10;
      let installError: unknown;

      for (let i = 0; i < attempts; i++) {
        try {
          await install(installOptions);
          installError = null; // Reset error on success
          break; // Exit loop on success
        } catch (e) {
          installError = e;
          console.log(
            `Attempt ${i + 1}/${attempts} failed. Retrying in 1 second...`,
          );
          // Wait for 1 second before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (installError) {
        throw installError;
      }

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
