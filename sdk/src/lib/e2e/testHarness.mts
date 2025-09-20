import { test, beforeEach, afterEach, expect, vi } from "vitest";
import { setupTestEnvironment } from "./environment.mjs";
import { runDevServer } from "./dev.mjs";
import {
  runRelease,
  deleteWorker,
  deleteD1Database,
  isRelatedToTest,
} from "./release.mjs";
import { launchBrowser } from "./browser.mjs";
import type { Browser, Page } from "puppeteer-core";
import type { TestResources } from "./types.mjs";
import { dirname, resolve } from "path";

interface DevServerContext {
  url: string;
  page: Page;
  browser: Browser;
  projectDir: string;
  stopDev: () => Promise<void>;
}

interface DeploymentContext {
  url: string;
  page: Page;
  browser: Browser;
  workerName: string;
}

type TestFunction<T> = (context: T) => Promise<void>;

// Environment variable flags for skipping tests
const SKIP_DEV_SERVER_TESTS =
  process.env.RWSDK_PLAYGROUND_SKIP_DEV_SERVER_TESTS === "1";
const SKIP_DEPLOYMENT_TESTS =
  process.env.RWSDK_PLAYGROUND_SKIP_DEPLOYMENT_TESTS === "1";

/**
 * Get the project directory for the current test by looking at the call stack
 */
function getProjectDirectory(): string {
  // For now, let's hardcode this to 'playground/minimal' since we only have one project
  // TODO: Make this more dynamic when we have multiple playground projects
  return "playground/minimal";
}

/**
 * High-level test wrapper for dev server tests with automatic setup/teardown
 */
export function testDevServer(
  name: string,
  testFn: TestFunction<DevServerContext>,
) {
  if (SKIP_DEV_SERVER_TESTS) {
    test.skip(name, () => {});
    return;
  }

  test(name, async () => {
    let resources: TestResources | undefined;
    let devServer: { stopDev: () => Promise<void> } | undefined;
    let browser: Browser | undefined;
    let testFailed = false;

    try {
      // Set up test environment with tarball installation
      // Detect the playground project directory from the test file location
      const projectDir = getProjectDirectory();
      resources = await setupTestEnvironment({
        projectDir,
        sync: true,
        packageManager: "pnpm",
      });

      if (!resources.targetDir) {
        throw new Error("Failed to set up test environment");
      }

      // Start dev server
      const devResult = await runDevServer("pnpm", resources.targetDir);
      devServer = devResult;

      // Launch browser
      browser = await launchBrowser();
      const page = await browser.newPage();

      // Run the test
      await testFn({
        url: devResult.url,
        page,
        browser,
        projectDir: resources.targetDir,
        stopDev: devResult.stopDev,
      });
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      // Cleanup
      if (devServer) {
        await devServer.stopDev();
      }
      if (browser) {
        await browser.close();
      }

      // Handle temp directory cleanup
      if (resources?.tempDirCleanup) {
        if (testFailed) {
          console.log(
            `\n🔍 Keeping failed test directory for debugging: ${resources.targetDir}`,
          );
        } else {
          await resources.tempDirCleanup();
        }
      }
    }
  });
}

/**
 * High-level test wrapper for deployment tests with automatic setup/teardown
 */
export function testDeployment(
  name: string,
  testFn: TestFunction<DeploymentContext>,
) {
  if (SKIP_DEPLOYMENT_TESTS) {
    test.skip(name, () => {});
    return;
  }

  test(name, async () => {
    let resources: TestResources | undefined;
    let browser: Browser | undefined;
    let workerName: string | undefined;
    let testFailed = false;

    try {
      // Set up test environment with tarball installation
      // Detect the playground project directory from the test file location
      const projectDir = getProjectDirectory();
      resources = await setupTestEnvironment({
        projectDir,
        sync: true,
        packageManager: "pnpm",
      });

      if (!resources.targetDir) {
        throw new Error("Failed to set up test environment");
      }

      // Deploy to Cloudflare
      const deployResult = await runRelease(
        resources.targetDir,
        resources.targetDir,
        resources.resourceUniqueKey,
      );
      workerName = deployResult.workerName;

      // Launch browser
      browser = await launchBrowser();
      const page = await browser.newPage();

      // Run the test
      await testFn({
        url: deployResult.url,
        page,
        browser,
        workerName,
      });
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      // Cleanup
      if (browser) {
        await browser.close();
      }
      if (workerName && resources) {
        // Clean up Cloudflare resources
        if (isRelatedToTest(workerName, resources.resourceUniqueKey)) {
          await deleteWorker(
            workerName,
            resources.targetDir || process.cwd(),
            resources.resourceUniqueKey,
          );
        }
        // Also clean up any D1 databases
        await deleteD1Database(
          resources.resourceUniqueKey,
          resources.targetDir || process.cwd(),
          resources.resourceUniqueKey,
        );
      }

      // Handle temp directory cleanup
      if (resources?.tempDirCleanup) {
        if (testFailed) {
          console.log(
            `\n🔍 Keeping failed test directory for debugging: ${resources.targetDir}`,
          );
        } else {
          await resources.tempDirCleanup();
        }
      }
    }
  });
}

// Add skip methods to the test functions
testDevServer.skip = (name: string, testFn: TestFunction<DevServerContext>) => {
  test.skip(name, () => {});
};

testDeployment.skip = (
  name: string,
  testFn: TestFunction<DeploymentContext>,
) => {
  test.skip(name, () => {});
};

/**
 * Lower-level function to create a dev server without automatic cleanup
 */
export async function createDevServer(projectDir?: string): Promise<{
  url: string;
  stopDev: () => Promise<void>;
  resources: TestResources;
}> {
  const resources = await setupTestEnvironment({
    projectDir: projectDir || getProjectDirectory(),
    sync: true,
    packageManager: "pnpm",
  });

  if (!resources.targetDir) {
    throw new Error("Failed to set up test environment");
  }

  const devResult = await runDevServer("pnpm", resources.targetDir);

  return {
    url: devResult.url,
    stopDev: devResult.stopDev,
    resources,
  };
}

/**
 * Lower-level function to create a deployment without automatic cleanup
 */
export async function createDeployment(projectDir?: string): Promise<{
  url: string;
  workerName: string;
  resources: TestResources;
}> {
  const resources = await setupTestEnvironment({
    projectDir: projectDir || getProjectDirectory(),
    sync: true,
    packageManager: "pnpm",
  });

  if (!resources.targetDir) {
    throw new Error("Failed to set up test environment");
  }

  const deployResult = await runRelease(
    resources.targetDir,
    resources.targetDir,
    resources.resourceUniqueKey,
  );

  return {
    url: deployResult.url,
    workerName: deployResult.workerName,
    resources,
  };
}

/**
 * Utility function for polling/retrying assertions
 */
export async function poll(
  fn: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (result) {
        return;
      }
    } catch (error) {
      // Continue polling on errors
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Polling timed out after ${timeout}ms`);
}
