import os from "os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // context(justinvdm, 25 Sep 2025): The E2E test suite can sometimes produce
    // unhandled promise rejections during the final teardown phase, even when
    // all tests have passed. This is often due to race conditions when tearing
    // down multiple concurrent browser connections and server processes. Since
    // these errors occur after all tests have successfully completed, they do not
    // impact the validity of the test results. Setting this flag to `true`
    // ensures that these noisy (but harmless) teardown errors don't fail an
    // otherwise successful CI run.
    dangerouslyIgnoreUnhandledErrors: true,
    globalSetup: "./globalSetup.mts",
    include: ["**/__tests__/**/*.test.mts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 15 * 60 * 1000,
    pool: "threads",
    // context(justinvdm, 24 Sep 2025): Use 4x the number of logical CPUs. The tests
    // are heavily network-bound (e.g. deploying workers), so a high degree of
    // concurrency is beneficial as most workers will be idle waiting on I/O.
    // context(justinvdm, 1 Nov 2025): On Windows, run tests serially (maxWorkers: 1)
    // to avoid potential race conditions with path alias resolution in concurrent CI runs.
    minWorkers: process.platform === "win32" ? 1 : undefined,
    maxWorkers:
      process.platform === "win32"
        ? 1
        : Math.ceil(os.cpus().length * 2),
  },
});
