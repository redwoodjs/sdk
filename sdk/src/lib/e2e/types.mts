export type PackageManager = "pnpm" | "npm" | "yarn" | "yarn-classic";

/**
 * Options for smoke tests
 */
export interface SmokeTestOptions {
  projectDir?: string;
  artifactDir?: string;
  headless?: boolean;
  keep?: boolean;
  sync?: boolean;
  bail?: boolean;
  skipDev?: boolean;
  skipRelease?: boolean;
  skipClient?: boolean;
  packageManager?: PackageManager;
  realtime?: boolean;
  skipHmr?: boolean;
  skipStyleTests?: boolean;
  tarballPath?: string;
}

/**
 * Resources created during a test run that need to be cleaned up
 */
export interface TestResources {
  tempDirCleanup?: () => Promise<void>;
  workerName?: string;
  targetDir?: string;
  originalCwd: string;
  workerCreatedDuringTest: boolean;
  stopDev?: () => Promise<void>;
  resourceUniqueKey: string;
}
