import {
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  vi,
} from "vitest";
import { setupTarballEnvironment } from "./tarball.mjs";
import { runDevServer } from "./dev.mjs";
import {
  runRelease,
  deleteWorker,
  deleteD1Database,
  isRelatedToTest,
} from "./release.mjs";
import { launchBrowser } from "./browser.mjs";
import type { Browser, Page } from "puppeteer-core";
import { dirname, resolve } from "path";

interface PlaygroundEnvironment {
  projectDir: string;
  cleanup: () => Promise<void>;
}

interface DevServerInstance {
  url: string;
  stopDev: () => Promise<void>;
}

interface DeploymentInstance {
  url: string;
  workerName: string;
  resourceUniqueKey: string;
}

// Environment variable flags for skipping tests
const SKIP_DEV_SERVER_TESTS = process.env.RWSDK_SKIP_DEV === "1";
const SKIP_DEPLOYMENT_TESTS = process.env.RWSDK_SKIP_DEPLOY === "1";

// Global test environment state
let globalPlaygroundEnv: PlaygroundEnvironment | null = null;

// Global cleanup registry
interface CleanupTask {
  id: string;
  cleanup: () => Promise<void>;
  type: "devServer" | "deployment" | "browser";
}

const cleanupTasks: CleanupTask[] = [];
let hooksRegistered = false;

/**
 * Registers global cleanup hooks automatically
 */
function ensureHooksRegistered() {
  if (hooksRegistered) return;

  // Register global afterEach to clean up resources created during tests
  afterEach(async () => {
    const tasksToCleanup = [...cleanupTasks];
    cleanupTasks.length = 0; // Clear the array

    for (const task of tasksToCleanup) {
      try {
        await task.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup ${task.type} ${task.id}:`, error);
      }
    }
  });

  // Register global afterAll to clean up the playground environment
  afterAll(async () => {
    if (globalPlaygroundEnv) {
      try {
        await globalPlaygroundEnv.cleanup();
        globalPlaygroundEnv = null;
      } catch (error) {
        console.warn("Failed to cleanup playground environment:", error);
      }
    }
  });

  hooksRegistered = true;
}

/**
 * Registers a cleanup task to be executed automatically
 */
function registerCleanupTask(task: CleanupTask) {
  ensureHooksRegistered();
  cleanupTasks.push(task);
}

/**
 * Removes a cleanup task from the registry (when manually cleaned up)
 */
function unregisterCleanupTask(id: string) {
  const index = cleanupTasks.findIndex((task) => task.id === id);
  if (index !== -1) {
    cleanupTasks.splice(index, 1);
  }
}

/**
 * Get the project directory for the current test by looking at the call stack
 */
function getProjectDirectory(): string {
  // For now, let's hardcode this to '../playground/hello-world' since we only have one project
  // TODO: Make this more dynamic when we have multiple playground projects
  return "../playground/hello-world";
}

/**
 * Derive the playground directory from import.meta.url
 */
function getPlaygroundDirFromImportMeta(importMetaUrl: string): string {
  const url = new URL(importMetaUrl);
  const testFilePath = url.pathname;

  // Extract playground name from path like: /path/to/playground/PLAYGROUND_NAME/__tests__/e2e.test.mts
  const playgroundMatch = testFilePath.match(
    /\/playground\/([^\/]+)\/__tests__\//,
  );

  if (playgroundMatch) {
    const playgroundName = playgroundMatch[1];
    // Return the absolute path to the playground directory
    const playgroundPath = testFilePath.replace(/\/__tests__\/.*$/, "");
    return playgroundPath;
  }

  throw new Error(
    `Could not determine playground directory from import.meta.url: ${importMetaUrl}`,
  );
}

/**
 * Sets up a playground environment for the entire test suite.
 * Automatically registers beforeAll and afterAll hooks.
 *
 * @param sourceProjectDir - Explicit path to playground directory, or import.meta.url to auto-detect
 */
export function setupPlaygroundEnvironment(sourceProjectDir?: string): void {
  ensureHooksRegistered();

  beforeAll(async () => {
    let projectDir: string;

    if (!sourceProjectDir) {
      projectDir = getProjectDirectory();
    } else if (sourceProjectDir.startsWith("file://")) {
      // This is import.meta.url, derive the playground directory
      projectDir = getPlaygroundDirFromImportMeta(sourceProjectDir);
    } else {
      // This is an explicit path
      projectDir = sourceProjectDir;
    }

    console.log(`Setting up playground environment from ${projectDir}...`);

    const tarballEnv = await setupTarballEnvironment({
      projectDir,
      packageManager: "pnpm",
    });

    globalPlaygroundEnv = {
      projectDir: tarballEnv.targetDir,
      cleanup: tarballEnv.cleanup,
    };
  });
}

/**
 * Gets the current playground environment.
 * Throws if no environment has been set up.
 */
export function getPlaygroundEnvironment(): PlaygroundEnvironment {
  if (!globalPlaygroundEnv) {
    throw new Error(
      "No playground environment set up. Call setupPlaygroundEnvironment() in beforeAll()",
    );
  }
  return globalPlaygroundEnv;
}

/**
 * Creates a dev server instance using the shared playground environment.
 * Automatically registers cleanup to run after the test.
 */
export async function createDevServer(): Promise<DevServerInstance> {
  if (SKIP_DEV_SERVER_TESTS) {
    throw new Error("Dev server tests are skipped via RWSDK_SKIP_DEV=1");
  }

  const env = getPlaygroundEnvironment();
  const devResult = await runDevServer("pnpm", env.projectDir);

  const serverId = `devServer-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  // Register automatic cleanup
  registerCleanupTask({
    id: serverId,
    type: "devServer",
    cleanup: devResult.stopDev,
  });

  return {
    url: devResult.url,
    stopDev: async () => {
      await devResult.stopDev();
      unregisterCleanupTask(serverId); // Remove from auto-cleanup since manually cleaned
    },
  };
}

/**
 * Creates a deployment instance using the shared playground environment.
 * Automatically registers cleanup to run after the test.
 */
export async function createDeployment(): Promise<DeploymentInstance> {
  if (SKIP_DEPLOYMENT_TESTS) {
    throw new Error("Deployment tests are skipped via RWSDK_SKIP_DEPLOY=1");
  }

  const env = getPlaygroundEnvironment();
  const resourceUniqueKey = Math.random().toString(36).substring(2, 15);

  const deployResult = await runRelease(
    env.projectDir,
    env.projectDir,
    resourceUniqueKey,
  );

  const deploymentId = `deployment-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  // Register automatic cleanup (non-blocking for deployments)
  registerCleanupTask({
    id: deploymentId,
    type: "deployment",
    cleanup: async () => {
      // Run deployment cleanup in background without blocking
      const performCleanup = async () => {
        if (isRelatedToTest(deployResult.workerName, resourceUniqueKey)) {
          await deleteWorker(
            deployResult.workerName,
            env.projectDir,
            resourceUniqueKey,
          );
        }
        await deleteD1Database(
          resourceUniqueKey,
          env.projectDir,
          resourceUniqueKey,
        );
      };

      // Start cleanup in background and return immediately
      performCleanup().catch((error) => {
        console.warn(
          `Warning: Background deployment cleanup failed: ${(error as Error).message}`,
        );
      });
      return Promise.resolve();
    },
  });

  return {
    url: deployResult.url,
    workerName: deployResult.workerName,
    resourceUniqueKey,
  };
}

/**
 * Manually cleans up a deployment instance (deletes worker and D1 database).
 * This is optional since cleanup happens automatically after each test.
 */
export async function cleanupDeployment(
  deployment: DeploymentInstance,
): Promise<void> {
  const env = getPlaygroundEnvironment();

  if (isRelatedToTest(deployment.workerName, deployment.resourceUniqueKey)) {
    await deleteWorker(
      deployment.workerName,
      env.projectDir,
      deployment.resourceUniqueKey,
    );
  }

  await deleteD1Database(
    deployment.resourceUniqueKey,
    env.projectDir,
    deployment.resourceUniqueKey,
  );

  // Remove from auto-cleanup registry since manually cleaned
  const deploymentId = cleanupTasks.find(
    (task) =>
      task.type === "deployment" &&
      task.id.includes(deployment.resourceUniqueKey),
  )?.id;

  if (deploymentId) {
    unregisterCleanupTask(deploymentId);
  }
}

/**
 * Creates a browser instance for testing.
 * Automatically registers cleanup to run after the test.
 */
export async function createBrowser(): Promise<Browser> {
  // Check if we should run in headed mode for debugging
  const headless = process.env.RWSDK_HEADLESS !== "false";
  const browser = await launchBrowser(undefined, headless);
  const browserId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Register automatic cleanup
  registerCleanupTask({
    id: browserId,
    type: "browser",
    cleanup: async () => {
      try {
        await browser.close();
      } catch (error) {
        // Browser might already be closed, ignore the error
      }
    },
  });

  // Wrap the close method to handle cleanup registration
  const originalClose = browser.close.bind(browser);
  browser.close = async () => {
    await originalClose();
    unregisterCleanupTask(browserId); // Remove from auto-cleanup since manually closed
  };

  return browser;
}

/**
 * High-level test wrapper for dev server tests.
 * Automatically skips if RWSDK_SKIP_DEV=1
 */
export function testDev(
  name: string,
  testFn: (context: {
    devServer: DevServerInstance;
    browser: Browser;
    page: Page;
    url: string;
  }) => Promise<void>,
) {
  if (SKIP_DEV_SERVER_TESTS) {
    test.skip(name, () => {});
    return;
  }

  test(name, async () => {
    const devServer = await createDevServer();
    const browser = await createBrowser();
    const page = await browser.newPage();

    await testFn({
      devServer,
      browser,
      page,
      url: devServer.url,
    });
    // Automatic cleanup handled by afterEach hooks
  });
}

/**
 * Skip version of testDev
 */
testDev.skip = (name: string, testFn?: any) => {
  test.skip(name, testFn || (() => {}));
};

/**
 * High-level test wrapper for deployment tests.
 * Automatically skips if RWSDK_SKIP_DEPLOY=1
 */
export function testDeploy(
  name: string,
  testFn: (context: {
    deployment: DeploymentInstance;
    browser: Browser;
    page: Page;
    url: string;
  }) => Promise<void>,
) {
  if (SKIP_DEPLOYMENT_TESTS) {
    test.skip(name, () => {});
    return;
  }

  test(name, async () => {
    const deployment = await createDeployment();
    const browser = await createBrowser();
    const page = await browser.newPage();

    await testFn({
      deployment,
      browser,
      page,
      url: deployment.url,
    });
    // Automatic cleanup handled by afterEach hooks
  });
}

/**
 * Skip version of testDeploy
 */
testDeploy.skip = (name: string, testFn?: any) => {
  test.skip(name, testFn || (() => {}));
};

/**
 * Unified test function that runs the same test against both dev server and deployment.
 * Automatically skips based on environment variables.
 */
export function testDevAndDeploy(
  name: string,
  testFn: (context: {
    devServer?: DevServerInstance;
    deployment?: DeploymentInstance;
    browser: Browser;
    page: Page;
    url: string;
  }) => Promise<void>,
) {
  if (SKIP_DEV_SERVER_TESTS) {
    test.skip(`${name} (dev)`, () => {});
  } else {
    test(`${name} (dev)`, async () => {
      const devServer = await createDevServer();
      const browser = await createBrowser();
      const page = await browser.newPage();

      await testFn({
        devServer,
        browser,
        page,
        url: devServer.url,
      });
      // Automatic cleanup handled by afterEach hooks
    });
  }

  if (SKIP_DEPLOYMENT_TESTS) {
    test.skip(`${name} (deployment)`, () => {});
  } else {
    test(`${name} (deployment)`, async () => {
      const deployment = await createDeployment();
      const browser = await createBrowser();
      const page = await browser.newPage();

      await testFn({
        deployment,
        browser,
        page,
        url: deployment.url,
      });
      // Automatic cleanup handled by afterEach hooks
    });
  }
}

/**
 * Skip version of testDevAndDeploy
 */
testDevAndDeploy.skip = (name: string, testFn?: any) => {
  test.skip(`${name} (dev)`, testFn || (() => {}));
  test.skip(`${name} (deployment)`, testFn || (() => {}));
};

/**
 * Only version of testDevAndDeploy
 */
testDevAndDeploy.only = (
  name: string,
  testFn: (context: {
    devServer?: DevServerInstance;
    deployment?: DeploymentInstance;
    browser: Browser;
    page: Page;
    url: string;
  }) => Promise<void>,
) => {
  if (!SKIP_DEV_SERVER_TESTS) {
    test.only(`${name} (dev)`, async () => {
      const devServer = await createDevServer();
      const browser = await createBrowser();
      const page = await browser.newPage();

      await testFn({
        devServer,
        browser,
        page,
        url: devServer.url,
      });
    });
  }

  if (!SKIP_DEPLOYMENT_TESTS) {
    test.only(`${name} (deployment)`, async () => {
      const deployment = await createDeployment();
      const browser = await createBrowser();
      const page = await browser.newPage();

      await testFn({
        deployment,
        browser,
        page,
        url: deployment.url,
      });
    });
  }
};

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
