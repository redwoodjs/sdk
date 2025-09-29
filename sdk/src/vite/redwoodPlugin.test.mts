import path from "node:path";
import { describe, expect, it } from "vitest";
import { determineWorkerEntryPathname } from "./redwoodPlugin.mjs";

describe("determineWorkerEntryPathname", () => {
  const projectRootDir = "/test/project";

  it("should use the entry path from options if provided", async () => {
    const result = await determineWorkerEntryPathname({
      projectRootDir,
      workerConfigPath: "/test/project/wrangler.toml",
      options: { entry: { worker: "src/custom-worker.ts" } },
    });
    expect(result).toBe(path.join(projectRootDir, "src/custom-worker.ts"));
  });

  it("should use the main path from wrangler config if no entry option is provided", async () => {
    const readConfig = () => ({ main: "src/wrangler-worker.tsx" });
    const result = await determineWorkerEntryPathname({
      projectRootDir,
      workerConfigPath: "/test/project/wrangler.toml",
      options: {},
      readConfig: readConfig as any,
    });
    expect(result).toBe(path.join(projectRootDir, "src/wrangler-worker.tsx"));
  });

  it("should use the default path if wrangler config has no main property", async () => {
    const readConfig = () => ({});
    const result = await determineWorkerEntryPathname({
      projectRootDir,
      workerConfigPath: "/test/project/wrangler.toml",
      options: {},
      readConfig: readConfig as any,
    });
    expect(result).toBe(path.join(projectRootDir, "src/worker.tsx"));
  });
});
