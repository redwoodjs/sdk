import {
  setupTestEnvironment as setupE2ETestEnvironment,
  copyProjectToTempDir,
} from "../../lib/e2e/environment.mjs";
import {
  SmokeTestOptions,
  TestResources,
  PackageManager,
} from "../../lib/e2e/types.mjs";
import { createSmokeTestComponents } from "./codeUpdates.mjs";
import { log } from "./constants.mjs";

/**
 * Sets up the test environment for smoke tests, preparing any resources needed for testing
 */
export async function setupTestEnvironment(
  options: SmokeTestOptions = {},
): Promise<TestResources> {
  const resources = await setupE2ETestEnvironment(options);

  if (resources.targetDir) {
    // Create the smoke test components in the user's project
    log("Creating smoke test components");
    await createSmokeTestComponents(resources.targetDir, options.skipClient);
  }

  return resources;
}

export { copyProjectToTempDir };
