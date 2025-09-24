import {
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  vi,
} from "vitest";
import { basename, join as pathJoin, dirname } from "path";
import fs from "node:fs";
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

const SETUP_PLAYGROUND_ENV_TIMEOUT = 300_000;

const PUPPETEER_TIMEOUT = process.env.RWSDK_PUPPETEER_TIMEOUT
  ? parseInt(process.env.RWSDK_PUPPETEER_TIMEOUT, 10)
  : 60 * 1000 * 2;

const DEV_SERVER_TIMEOUT = process.env.RWSDK_DEV_SERVER_TIMEOUT
  ? parseInt(process.env.RWSDK_DEV_SERVER_TIMEOUT, 10)
  : 60 * 1000 * 2;

const HYDRATION_TIMEOUT = process.env.RWSDK_HYDRATION_TIMEOUT
  ? parseInt(process.env.RWSDK_HYDRATION_TIMEOUT, 10)
  : 5000;

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
  projectDir: string;
  cleanup: () => Promise<void>;
}

// Environment variable flags for skipping tests
const SKIP_DEV_SERVER_TESTS = process.env.RWSDK_SKIP_DEV === "1";
const SKIP_DEPLOYMENT_TESTS = process.env.RWSDK_SKIP_DEPLOY === "1";

// Global test environment state
let globalPlaygroundEnv: PlaygroundEnvironment | null = null;
let globalDevInstance: DevServerInstance | null = null;
let globalDeploymentInstance: DeploymentInstance | null = null;
let globalBrowser: Browser | null = null;

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
    const cleanupPromises = [];
    if (globalDevInstance) {
      cleanupPromises.push(globalDevInstance.stopDev());
    }
    if (globalDeploymentInstance) {
      cleanupPromises.push(globalDeploymentInstance.cleanup());
    }
    if (globalBrowser) {
      cleanupPromises.push(globalBrowser.close());
    }
    await Promise.all(cleanupPromises);
    globalDevInstance = null;
    globalDeploymentInstance = null;
    globalBrowser = null;

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
 * Derive the playground directory from import.meta.url by finding the nearest package.json
 */
function getPlaygroundDirFromImportMeta(importMetaUrl: string): string {
  const url = new URL(importMetaUrl);
  const testFilePath = url.pathname;

  let currentDir = dirname(testFilePath);
  // Walk up the tree from the test file's directory
  while (currentDir !== "/") {
    // Check if a package.json exists in the current directory
    if (fs.existsSync(pathJoin(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  throw new Error(
    `Could not determine playground directory from import.meta.url: ${importMetaUrl}. ` +
      `Failed to find a package.json in any parent directory.`,
  );
}

export interface SetupPlaygroundEnvironmentOptions {
  /**
   * The directory of the playground project to set up.
   * Can be an absolute path, or a `import.meta.url` `file://` string.
   * If not provided, it will be inferred from the test file's path.
   */
  sourceProjectDir?: string;
  /**
   * The root directory of the monorepo, if the project is part of one.
   * This is used to correctly set up the test environment for monorepo projects.
   */
  monorepoRoot?: string;
  /**
   * Whether to provision a dev server for the test suite.
   * @default true
   */
  dev?: boolean;
  /**
   * Whether to provision a deployment for the test suite.
   * @default true
   */
  deploy?: boolean;
}

/**
 * A Vitest hook that sets up a playground environment for a test file.
 * It creates a temporary directory, copies the playground project into it,
 * and installs dependencies using a tarball of the SDK.
 * This ensures that tests run in a clean, isolated environment.
 */
export function setupPlaygroundEnvironment(
  options: string | SetupPlaygroundEnvironmentOptions = {},
): void {
  const {
    sourceProjectDir,
    monorepoRoot,
    dev = true,
    deploy = true,
  } = typeof options === "string" ? { sourceProjectDir: options } : options;
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

    let devEnv: { targetDir: string; cleanup: () => Promise<void> } | undefined;
    if (dev) {
      devEnv = await setupTarballEnvironment({
        projectDir,
        monorepoRoot,
        packageManager:
          (process.env.PACKAGE_MANAGER as "pnpm" | "npm" | "yarn") || "pnpm",
      });
      globalPlaygroundEnv = {
        projectDir: devEnv.targetDir,
        cleanup: devEnv.cleanup,
      };
    }

    let deployEnv:
      | { targetDir: string; cleanup: () => Promise<void> }
      | undefined;
    if (deploy) {
      deployEnv = await setupTarballEnvironment({
        projectDir,
        monorepoRoot,
        packageManager:
          (process.env.PACKAGE_MANAGER as "pnpm" | "npm" | "yarn") || "pnpm",
      });
      // If there's no dev env, we still need to set the global env for cleanup
      if (!devEnv) {
        globalPlaygroundEnv = {
          projectDir: deployEnv.targetDir,
          cleanup: deployEnv.cleanup,
        };
      }
    }

    const [devInstance, deployInstance, browser] = await Promise.all([
      dev && devEnv ? createDevServer(devEnv.targetDir) : Promise.resolve(null),
      deploy && deployEnv
        ? createDeployment(deployEnv.targetDir)
        : Promise.resolve(null),
      createBrowser(),
    ]);

    globalDevInstance = devInstance;
    globalDeploymentInstance = deployInstance;
    globalBrowser = browser;
  }, SETUP_PLAYGROUND_ENV_TIMEOUT);
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
export async function createDevServer(
  projectDir: string,
): Promise<DevServerInstance> {
  if (SKIP_DEV_SERVER_TESTS) {
    throw new Error("Dev server tests are skipped via RWSDK_SKIP_DEV=1");
  }

  const packageManager =
    (process.env.PACKAGE_MANAGER as "pnpm" | "npm" | "yarn") || "pnpm";
  const devResult = await runDevServer(packageManager, projectDir);

  return {
    url: devResult.url,
    stopDev: devResult.stopDev,
  };
}

/**
 * Creates a deployment instance using the shared playground environment.
 * Automatically registers cleanup to run after the test.
 */
export async function createDeployment(
  projectDir: string,
): Promise<DeploymentInstance> {
  if (SKIP_DEPLOYMENT_TESTS) {
    throw new Error("Deployment tests are skipped via RWSDK_SKIP_DEPLOY=1");
  }

  // Extract the unique key from the project directory name instead of generating a new one
  // The directory name format is: {projectName}-e2e-test-{randomId}
  const dirName = basename(projectDir);
  const match = dirName.match(/-e2e-test-([a-f0-9]+)$/);
  const resourceUniqueKey = match
    ? match[1]
    : Math.random().toString(36).substring(2, 15);

  const deployResult = await runRelease(
    projectDir,
    projectDir,
    resourceUniqueKey,
  );

  // Poll the URL to ensure it's live before proceeding
  await poll(
    async () => {
      try {
        const response = await fetch(deployResult.url);
        // We consider any response (even 4xx or 5xx) as success,
        // as it means the worker is routable.
        return response.status > 0;
      } catch (e) {
        return false;
      }
    },
    DEV_SERVER_TIMEOUT, // 60-second timeout for warm-up
  );

  const cleanup = async () => {
    // Run deployment cleanup in background without blocking
    const performCleanup = async () => {
      if (isRelatedToTest(deployResult.workerName, resourceUniqueKey)) {
        await deleteWorker(
          deployResult.workerName,
          projectDir,
          resourceUniqueKey,
        );
      }
      await deleteD1Database(resourceUniqueKey, projectDir, resourceUniqueKey);
    };

    // Start cleanup in background and return immediately
    performCleanup().catch((error) => {
      console.warn(
        `Warning: Background deployment cleanup failed: ${
          (error as Error).message
        }`,
      );
    });
    return Promise.resolve();
  };

  return {
    url: deployResult.url,
    workerName: deployResult.workerName,
    resourceUniqueKey,
    projectDir: projectDir,
    cleanup,
  };
}

/**
 * Manually cleans up a deployment instance (deletes worker and D1 database).
 * This is optional since cleanup happens automatically after each test.
 */
export async function cleanupDeployment(
  deployment: DeploymentInstance,
): Promise<void> {
  console.log(
    `🧹 Cleaning up deployment: ${deployment.workerName} (${deployment.resourceUniqueKey})`,
  );
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
  return browser;
}

/**
 * Executes a test function with a retry mechanism for specific error codes.
 * @param name - The name of the test, used for logging.
 * @param attemptFn - A function that executes one attempt of the test.
 *                     It should set up resources, run the test logic, and
 *                     return a cleanup function. The cleanup function will be
 *                     called automatically on failure.
 */
export async function runTestWithRetries(
  name: string,
  attemptFn: () => Promise<{ cleanup: () => Promise<void> }>,
) {
  const MAX_RETRIES_PER_CODE = 6;
  const retryCounts: Record<string, number> = {};
  let attempt = 0;

  while (true) {
    attempt++;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      const res = await attemptFn();
      cleanup = res.cleanup;

      if (attempt > 1) {
        console.log(
          `[runTestWithRetries] Test "${name}" succeeded on attempt ${attempt}.`,
        );
      }
      // On success, we don't run cleanup here. It will be handled by afterEach.
      return; // Success
    } catch (e: any) {
      // On failure, run the cleanup from the failed attempt.
      // The cleanup function is attached to the error object on failure.
      const errorCleanup = e.cleanup;
      if (typeof errorCleanup === "function") {
        await errorCleanup().catch((err: any) =>
          console.warn(
            `[runTestWithRetries] Cleanup failed for "${name}" during retry:`,
            err,
          ),
        );
      }

      const errorCode = e?.code;
      if (typeof errorCode === "string" && errorCode) {
        const count = (retryCounts[errorCode] || 0) + 1;
        retryCounts[errorCode] = count;

        if (count <= MAX_RETRIES_PER_CODE) {
          console.log(
            `[runTestWithRetries] Attempt ${attempt} for "${name}" failed with code ${errorCode}. Retrying (failure ${count}/${MAX_RETRIES_PER_CODE} for this code)...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue; // Next attempt
        } else {
          console.error(
            `[runTestWithRetries] Test "${name}" failed with code ${errorCode} after ${MAX_RETRIES_PER_CODE} retries for this code.`,
          );
          throw e; // Give up
        }
      } else {
        console.error(
          `[runTestWithRetries] Test "${name}" failed on attempt ${attempt} with a non-retryable error:`,
          e,
        );
        throw e;
      }
    }
  }
}

function createTestRunner(
  testFn: typeof test | typeof test.only,
  envType: "dev" | "deploy",
) {
  return (
    name: string,
    testLogic: (context: {
      devServer?: DevServerInstance;
      deployment?: DeploymentInstance;
      browser: Browser;
      page: Page;
      url: string;
    }) => Promise<void>,
  ) => {
    if (
      (envType === "dev" && SKIP_DEV_SERVER_TESTS) ||
      (envType === "deploy" && SKIP_DEPLOYMENT_TESTS)
    ) {
      test.skip(name, () => {});
      return;
    }

    testFn(name, async () => {
      await runTestWithRetries(name, async () => {
        const instance =
          envType === "dev" ? globalDevInstance : globalDeploymentInstance;
        if (!instance) {
          throw new Error(
            `No ${envType} instance found. Make sure to enable it in setupPlaygroundEnvironment.`,
          );
        }

        if (!globalBrowser) {
          throw new Error(
            "No browser instance found. Make sure to enable it in setupPlaygroundEnvironment.",
          );
        }

        const page = await globalBrowser.newPage();
        page.setDefaultTimeout(PUPPETEER_TIMEOUT);

        const cleanup = async () => {
          await page.close();
        };

        try {
          await testLogic({
            [envType === "dev" ? "devServer" : "deployment"]: instance,
            browser: globalBrowser,
            page,
            url: instance.url,
          });

          return { cleanup };
        } catch (error) {
          throw Object.assign(error as Error, { cleanup });
        }
      });
    });
  };
}

/**
 * High-level test wrapper for dev server tests.
 * Automatically skips if RWSDK_SKIP_DEV=1
 */
export function testDev(
  ...args: Parameters<ReturnType<typeof createTestRunner>>
) {
  return createTestRunner(test.concurrent, "dev")(...args);
}
testDev.skip = (name: string, testFn?: any) => {
  test.skip(name, testFn || (() => {}));
};
testDev.only = createTestRunner(test.only, "dev");

/**
 * High-level test wrapper for deployment tests.
 * Automatically skips if RWSDK_SKIP_DEPLOY=1
 */
export function testDeploy(
  ...args: Parameters<ReturnType<typeof createTestRunner>>
) {
  return createTestRunner(test.concurrent, "deploy")(...args);
}
testDeploy.skip = (name: string, testFn?: any) => {
  test.skip(name, testFn || (() => {}));
};
testDeploy.only = createTestRunner(test.only, "deploy");

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
  testDev(`${name} (dev)`, testFn);
  testDeploy(`${name} (deployment)`, testFn);
}

/**
 * Skip version of testDevAndDeploy
 */
testDevAndDeploy.skip = (name: string, testFn?: any) => {
  test.skip(name, testFn || (() => {}));
};

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
  testDev.only(`${name} (dev)`, testFn);
  testDeploy.only(`${name} (deployment)`, testFn);
};

/**
 * Utility function for polling/retrying assertions
 */
export async function poll(
  fn: () => Promise<boolean>,
  timeout: number = 2 * 60 * 1000, // 2 minutes
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

/**
 * Waits for the page to be fully loaded and hydrated.
 * This should be used before any user interaction is simulated.
 */
export async function waitForHydration(page: Page) {
  // 1. Wait for the document to be fully loaded.
  await page.waitForFunction('document.readyState === "complete"');
  // 2. Wait a short, fixed amount of time for client-side hydration to finish.
  // This is a pragmatic approach to ensure React has mounted.
  await new Promise((resolve) => setTimeout(resolve, HYDRATION_TIMEOUT));
}
