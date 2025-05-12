import { SmokeTestOptions, TestResources } from "./types.mjs";

// Define possible test status values
export type TestStatusValue = "SKIPPED" | "DID_NOT_RUN" | "PASSED" | "FAILED";

// Define test status tracking structure
export interface TestStatus {
  // Development environment tests
  dev: {
    overall: TestStatusValue;
    initialServerSide: TestStatusValue;
    initialClientSide: TestStatusValue;
    realtimeUpgrade: TestStatusValue;
    realtimeServerSide: TestStatusValue;
    realtimeClientSide: TestStatusValue;
  };
  // Production environment tests
  production: {
    overall: TestStatusValue;
    releaseCommand: TestStatusValue;
    initialServerSide: TestStatusValue;
    initialClientSide: TestStatusValue;
    realtimeUpgrade: TestStatusValue;
    realtimeServerSide: TestStatusValue;
    realtimeClientSide: TestStatusValue;
  };
}

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
  // New detailed test status tracking
  testStatus: {
    dev: {
      overall: "DID_NOT_RUN",
      initialServerSide: "DID_NOT_RUN",
      initialClientSide: "DID_NOT_RUN",
      realtimeUpgrade: "DID_NOT_RUN",
      realtimeServerSide: "DID_NOT_RUN",
      realtimeClientSide: "DID_NOT_RUN",
    },
    production: {
      overall: "DID_NOT_RUN",
      releaseCommand: "DID_NOT_RUN",
      initialServerSide: "DID_NOT_RUN",
      initialClientSide: "DID_NOT_RUN",
      realtimeUpgrade: "DID_NOT_RUN",
      realtimeServerSide: "DID_NOT_RUN",
      realtimeClientSide: "DID_NOT_RUN",
    },
  } as TestStatus,
};

// Helper function to update test status
export function updateTestStatus(
  env: "dev" | "production",
  test: keyof TestStatus["dev"] | keyof TestStatus["production"],
  status: TestStatusValue,
): void {
  (state.testStatus[env] as any)[test] = status;
}
