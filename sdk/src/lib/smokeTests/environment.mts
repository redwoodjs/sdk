import { setupTarballEnvironment } from "../../lib/e2e/tarball.mjs";
import { TestResources } from "../../lib/e2e/types.mjs";
import { createSmokeTestComponents } from "./codeUpdates.mjs";
import { log } from "./constants.mjs";
import { SmokeTestOptions } from "./types.mjs";

/**
 * Sets up the test environment for smoke tests, preparing any resources needed for testing
 */
export async function setupTestEnvironment(
  options: SmokeTestOptions = {},
): Promise<TestResources> {
  if (!options.projectDir) {
    throw new Error("projectDir is required for smoke tests");
  }

  const tarballEnv = await setupTarballEnvironment({
    projectDir: options.projectDir,
    packageManager: options.packageManager,
  });

  const resources: TestResources = {
    tempDirCleanup: tarballEnv.cleanup,
    workerName: undefined,
    originalCwd: process.cwd(),
    targetDir: tarballEnv.targetDir,
    workerCreatedDuringTest: false,
    stopDev: undefined,
    resourceUniqueKey: `smoke-test-${Date.now()}`,
  };

  if (resources.targetDir) {
    // Create the smoke test components in the user's project
    log("Creating smoke test components");
    await createSmokeTestComponents(resources.targetDir, options.skipClient);
  }

  return resources;
}
