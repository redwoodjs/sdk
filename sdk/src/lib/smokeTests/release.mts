import { setTimeout } from "node:timers/promises";
import {
  $expect,
  deleteD1Database,
  deleteWorker,
  isRelatedToTest,
  listD1Databases,
  runRelease as runE2ERelease,
} from "../../lib/e2e/release.mjs";
import { checkServerUp, checkUrl } from "./browser.mjs";
import { log } from "./constants.mjs";
import { TestResources } from "./types.mjs";

export {
  $expect,
  deleteD1Database,
  deleteWorker,
  isRelatedToTest,
  listD1Databases,
};

/**
 * Run the release command to deploy to Cloudflare
 */
export async function runRelease(
  cwd: string,
  projectDir: string,
  resourceUniqueKey: string,
): Promise<{ url: string; workerName: string }> {
  return runE2ERelease(cwd, projectDir, resourceUniqueKey);
}

/**
 * Runs tests against the production deployment
 */
export async function runReleaseTest(
  artifactDir: string,
  resources: TestResources,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
  projectDir?: string,
  realtime: boolean = false,
  skipHmr: boolean = false,
  skipStyleTests: boolean = false,
): Promise<void> {
  log("Starting release test");
  console.log("\n🚀 Testing production deployment");

  try {
    log("Running release process");
    const { url, workerName } = await runRelease(
      resources.targetDir || "",
      projectDir || "",
      resources.resourceUniqueKey,
    );

    // Wait a moment before checking server availability
    log("Waiting 1s before checking server...");
    await setTimeout(1000);

    // DRY: check both root and custom path
    await checkServerUp(url, "/");

    // Now run the tests with the custom path
    const testUrl = new URL("/__smoke_test", url).toString();
    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
      "Production",
      realtime,
      resources.targetDir, // Add target directory parameter
      true, // Always skip HMR in production
      skipStyleTests, // Add skip style tests option
    );
    log("Release test completed successfully");

    // Store the worker name if we didn't set it earlier
    if (resources && !resources.workerName) {
      log("Storing worker name: %s", workerName);
      resources.workerName = workerName;
    }

    // Mark that we created this worker during the test
    if (resources) {
      log("Marking worker %s as created during this test", workerName);
      resources.workerCreatedDuringTest = true;

      // Update the global state
      if (resources.workerCreatedDuringTest !== undefined) {
        resources.workerCreatedDuringTest = true;
      }
    }
  } catch (error) {
    log("Error during release testing: %O", error);
    throw error;
  }
}
