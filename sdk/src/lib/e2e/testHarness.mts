import {
  test,
  beforeAll,
  afterAll,
  afterEach,
  describe,
  beforeEach,
} from "vitest";
import { basename, join as pathJoin, dirname } from "path";
import { setupTarballEnvironment } from "./tarball.mjs";
import { runDevServer } from "./dev.mjs";
import {
  runRelease,
  deleteWorker,
  deleteD1Database,
  isRelatedToTest,
} from "./release.mjs";
import { launchBrowser } from "./browser.mjs";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
export type { Browser, Page } from "puppeteer-core";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { poll, pollValue } from "./poll.mjs";

const SETUP_PLAYGROUND_ENV_TIMEOUT = process.env
  .RWSDK_SETUP_PLAYGROUND_ENV_TIMEOUT
  ? parseInt(process.env.RWSDK_SETUP_PLAYGROUND_ENV_TIMEOUT, 10)
  : 5 * 60 * 1000;

const DEPLOYMENT_TIMEOUT = process.env.RWSDK_DEPLOYMENT_TIMEOUT
  ? parseInt(process.env.RWSDK_DEPLOYMENT_TIMEOUT, 10)
  : 5 * 60 * 1000;

const DEPLOYMENT_MIN_TRIES = process.env.RWSDK_DEPLOYMENT_MIN_TRIES
  ? parseInt(process.env.RWSDK_DEPLOYMENT_MIN_TRIES, 10)
  : 5;

const DEPLOYMENT_CHECK_TIMEOUT = process.env.RWSDK_DEPLOYMENT_CHECK_TIMEOUT
  ? parseInt(process.env.RWSDK_DEPLOYMENT_CHECK_TIMEOUT, 10)
  : 5 * 60 * 1000;

const PUPPETEER_TIMEOUT = process.env.RWSDK_PUPPETEER_TIMEOUT
  ? parseInt(process.env.RWSDK_PUPPETEER_TIMEOUT, 10)
  : 60 * 1000 * 2;

const HYDRATION_TIMEOUT = process.env.RWSDK_HYDRATION_TIMEOUT
  ? parseInt(process.env.RWSDK_HYDRATION_TIMEOUT, 10)
  : 5000;

const DEV_SERVER_TIMEOUT = process.env.RWSDK_DEV_SERVER_TIMEOUT
  ? parseInt(process.env.RWSDK_DEV_SERVER_TIMEOUT, 10)
  : 5 * 60 * 1000;

const DEV_SERVER_MIN_TRIES = process.env.RWSDK_DEV_SERVER_MIN_TRIES
  ? parseInt(process.env.RWSDK_DEV_SERVER_MIN_TRIES, 10)
  : 5;

const SETUP_WAIT_TIMEOUT = process.env.RWSDK_SETUP_WAIT_TIMEOUT
  ? parseInt(process.env.RWSDK_SETUP_WAIT_TIMEOUT, 10)
  : 6 * 60 * 1000;

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
let globalDevPlaygroundEnv: PlaygroundEnvironment | null = null;
let globalDeployPlaygroundEnv: PlaygroundEnvironment | null = null;
let globalDevInstancePromise: Promise<DevServerInstance | null> | null = null;
let globalDeploymentInstancePromise: Promise<DeploymentInstance | null> | null =
  null;

let hooksRegistered = false;

/**
 * Registers global cleanup hooks automatically
 */
function ensureHooksRegistered() {
  if (hooksRegistered) return;

  // Register global afterAll to clean up the playground environment
  afterAll(async () => {
    const cleanupPromises = [];
    if (globalDevInstancePromise) {
      // The cleanup for globalDevInstance is now handled within the test suite's beforeAll/afterAll
      // globalDevInstancePromise.then(instance => instance?.stopDev()).catch(() => {});
    }
    if (globalDeploymentInstancePromise) {
      // The cleanup for globalDeploymentInstance is now handled within the test suite's beforeAll/afterAll
      // globalDeploymentInstancePromise.then(instance => instance?.cleanup()).catch(() => {});
    }
    if (globalDevPlaygroundEnv) {
      cleanupPromises.push(globalDevPlaygroundEnv.cleanup());
    }
    if (globalDeployPlaygroundEnv) {
      cleanupPromises.push(globalDeployPlaygroundEnv.cleanup());
    }

    await Promise.all(cleanupPromises);
    globalDevPlaygroundEnv = null;
    globalDeployPlaygroundEnv = null;
  });

  hooksRegistered = true;
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

    if (dev) {
      const devEnv = await setupTarballEnvironment({
        projectDir,
        monorepoRoot,
        packageManager:
          (process.env.PACKAGE_MANAGER as "pnpm" | "npm" | "yarn") || "pnpm",
      });
      globalDevPlaygroundEnv = {
        projectDir: devEnv.targetDir,
        cleanup: devEnv.cleanup,
      };
      globalDevInstancePromise = createDevServer(devEnv.targetDir).then(
        (instance) => {
          globalDevInstance = instance;
          return instance;
        },
      );
      // Prevent unhandled promise rejections. The error will be handled inside
      // the test's beforeEach hook where this promise is awaited.
      globalDevInstancePromise.catch(() => {});
    } else {
      globalDevInstancePromise = Promise.resolve(null);
    }

    if (deploy) {
      const deployEnv = await setupTarballEnvironment({
        projectDir,
        monorepoRoot,
        packageManager:
          (process.env.PACKAGE_MANAGER as "pnpm" | "npm" | "yarn") || "pnpm",
      });
      globalDeployPlaygroundEnv = {
        projectDir: deployEnv.targetDir,
        cleanup: deployEnv.cleanup,
      };
      globalDeploymentInstancePromise = createDeployment(
        deployEnv.targetDir,
      ).then((instance) => {
        globalDeploymentInstance = instance;
        return instance;
      });
      // Prevent unhandled promise rejections
      globalDeploymentInstancePromise.catch(() => {});
    } else {
      globalDeploymentInstancePromise = Promise.resolve(null);
    }
  }, SETUP_PLAYGROUND_ENV_TIMEOUT);
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

  const devResult = await pollValue(
    () => runDevServer(packageManager, projectDir),
    {
      timeout: DEV_SERVER_TIMEOUT,
      minTries: DEV_SERVER_MIN_TRIES,
      onRetry: (error, tries) => {
        console.log(
          `Retrying dev server creation (attempt ${tries})... Error: ${
            (error as Error).message
          }`,
        );
      },
    },
  );

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

  return await pollValue(
    async () => {
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
        {
          timeout: DEPLOYMENT_CHECK_TIMEOUT,
        },
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
          await deleteD1Database(
            resourceUniqueKey,
            projectDir,
            resourceUniqueKey,
          );
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
    },
    {
      timeout: DEPLOYMENT_TIMEOUT,
      minTries: DEPLOYMENT_MIN_TRIES,
      onRetry: (error, tries) => {
        console.log(
          `Retrying deployment creation (attempt ${tries})... Error: ${
            (error as Error).message
          }`,
        );
      },
    },
  );
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
  attemptFn: () => Promise<void>,
) {
  const MAX_RETRIES_PER_CODE = 6;
  const retryCounts: Record<string, number> = {};
  let attempt = 0;

  while (true) {
    attempt++;

    try {
      await attemptFn();

      if (attempt > 1) {
        console.log(
          `[runTestWithRetries] Test "${name}" succeeded on attempt ${attempt}.`,
        );
      }
      return; // Success
    } catch (e: any) {
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
  testFn: (typeof test | typeof test.only)["concurrent"],
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

    describe.concurrent(name, () => {
      let page: Page;
      let instance: DevServerInstance | DeploymentInstance | null;
      let browser: Browser;

      beforeAll(async () => {
        const tempDir = path.join(os.tmpdir(), "rwsdk-e2e-tests");
        const wsEndpointFile = path.join(tempDir, "wsEndpoint");

        try {
          const wsEndpoint = await fs.readFile(wsEndpointFile, "utf-8");
          browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
        } catch (error) {
          console.warn(
            "Failed to connect to existing browser instance. " +
              "This might happen if you are running a single test file. " +
              "Launching a new browser instance instead.",
          );
          browser = await launchBrowser();
        }
      }, SETUP_WAIT_TIMEOUT);

      afterAll(async () => {
        if (browser) {
          await browser.disconnect();
        }
      });

      beforeEach(async () => {
        const instancePromise =
          envType === "dev"
            ? globalDevInstancePromise
            : globalDeploymentInstancePromise;

        if (!instancePromise) {
          throw new Error(
            "Test environment promises not initialized. Call setupPlaygroundEnvironment() in your test file.",
          );
        }

        [instance] = await Promise.all([instancePromise]);

        if (!instance) {
          throw new Error(
            `No ${envType} instance found. Make sure to enable it in setupPlaygroundEnvironment.`,
          );
        }

        page = await browser.newPage();
        page.setDefaultTimeout(PUPPETEER_TIMEOUT);
      }, SETUP_WAIT_TIMEOUT);

      afterEach(async () => {
        if (page) {
          try {
            await page.close();
          } catch (error) {
            // Suppress errors during page close, as the browser might already be disconnecting
            // due to the test suite finishing.
            console.warn(
              `Suppressing error during page.close() in test "${name}":`,
              error,
            );
          }
        }
      });

      testFn(">", async () => {
        if (!instance || !browser) {
          throw new Error("Test environment not ready.");
        }

        await runTestWithRetries(name, async () => {
          await testLogic({
            [envType === "dev" ? "devServer" : "deployment"]: instance,
            browser: browser as Browser,
            page: page as Page,
            url: (instance as DevServerInstance | DeploymentInstance).url,
          });
        });
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

export function trackPageErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()} | ${request.failure()?.errorText}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  return {
    get: () => ({
      // context(justinvdm, 25 Sep 2025): Filter out irrelevant 404s (e.g. favicon)
      consoleErrors: consoleErrors.filter((e) => !e.includes("404")),
      failedRequests,
    }),
  };
}
