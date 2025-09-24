import os from "os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./playground/globalSetup.mts",
    include: ["**/__tests__/**/*.test.mts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 180000, // 3 minutes for e2e tests (includes Chrome download)
    hookTimeout: 180000, // 3 minutes for setup hooks (includes tarball installation)
    bail: process.env.RWSDK_NO_BAIL ? undefined : 1,
    pool: "threads",
    // context(justinvdm, 24 Sep 2025): Use 4x the number of logical CPUs. The tests
    // are heavily network-bound (e.g. deploying workers), so a high degree of
    // concurrency is beneficial as most workers will be idle waiting on I/O.
    maxWorkers: Math.ceil(os.cpus().length * 4),
  },
});
