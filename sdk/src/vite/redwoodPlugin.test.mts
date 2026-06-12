import { join } from "node:path/posix";
import { describe, expect, it } from "vitest";
import {
  determineRscFeatureFlags,
  determineWorkerEntryPathname,
} from "./redwoodPlugin.mjs";

describe("determineRscFeatureFlags", () => {
  it("uses plugin-rsc client references and manifest metadata by default while keeping server references off", () => {
    expect(determineRscFeatureFlags()).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: true,
      shouldUseViteRscServerReferences: false,
    });
  });

  it("keeps the legacy client-reference lookup path available as explicit rollback", () => {
    expect(
      determineRscFeatureFlags({
        experimentalUseViteRscClientReferences: false,
        experimentalUseViteRscManifestAdapter: true,
        experimentalViteRscServerReferences: true,
      }),
    ).toEqual({
      shouldUseViteRscClientReferences: false,
      shouldUseViteRscManifestAdapter: false,
      shouldUseViteRscServerReferences: false,
    });
  });

  it("can disable only the manifest adapter while keeping plugin-rsc client references", () => {
    expect(
      determineRscFeatureFlags({
        experimentalUseViteRscManifestAdapter: false,
      }),
    ).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: false,
      shouldUseViteRscServerReferences: false,
    });
  });

  it("keeps plugin-rsc server references opt-in", () => {
    expect(
      determineRscFeatureFlags({
        experimentalViteRscServerReferences: true,
      }),
    ).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: true,
      shouldUseViteRscServerReferences: true,
    });
  });
});

describe("determineWorkerEntryPathname", () => {
  const projectRootDir = "/test/project";

  it("should use the entry path from options if provided", async () => {
    const result = await determineWorkerEntryPathname({
      projectRootDir,
      workerConfigPath: "/test/project/wrangler.toml",
      options: { entry: { worker: "src/custom-worker.ts" } },
    });
    expect(result).toBe(join(projectRootDir, "src/custom-worker.ts"));
  });

  it("should use the main path from wrangler config if no entry option is provided", async () => {
    const readConfig = () => ({ main: "src/wrangler-worker.tsx" });
    const result = await determineWorkerEntryPathname({
      projectRootDir,
      workerConfigPath: "/test/project/wrangler.toml",
      options: {},
      readConfig: readConfig as any,
    });
    expect(result).toBe(join(projectRootDir, "src/wrangler-worker.tsx"));
  });

  it("should use the default path if wrangler config has no main property", async () => {
    const readConfig = () => ({});
    const result = await determineWorkerEntryPathname({
      projectRootDir,
      workerConfigPath: "/test/project/wrangler.toml",
      options: {},
      readConfig: readConfig as any,
    });
    expect(result).toBe(join(projectRootDir, "src/worker.tsx"));
  });
});
