import { SmokeTestOptions, TestResources } from "./types.mjs";

// Module-level state to track resources and teardown status
export const state = {
  isTearingDown: false,
  exitCode: 0,
  resources: {
    tempDirCleanup: undefined,
    workerName: undefined,
    originalCwd: process.cwd(),
    targetDir: undefined,
    workerCreatedDuringTest: false,
    stopDev: undefined,
  } as TestResources,
  options: {} as SmokeTestOptions,
  // Add a new failures array to track all failures
  failures: [] as { step: string; error: string; details?: string }[],
  // Track whether tests have actually run
  devTestsRan: false,
  releaseTestsRan: false,
};
