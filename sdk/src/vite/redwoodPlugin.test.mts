import { join } from "node:path/posix";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  determineRscFeatureFlags,
  determineWorkerEntryPathname,
} from "./redwoodPlugin.mjs";

describe("determineRscFeatureFlags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses plugin-rsc client references, manifest metadata, and server references by default", () => {
    expect(determineRscFeatureFlags()).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: true,
      shouldUseViteRscServerReferences: true,
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

  it("can disable only the manifest adapter while keeping plugin-rsc client and server references", () => {
    expect(
      determineRscFeatureFlags({
        experimentalUseViteRscManifestAdapter: false,
      }),
    ).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: false,
      shouldUseViteRscServerReferences: true,
    });
  });

  it("can explicitly disable plugin-rsc server references", () => {
    expect(
      determineRscFeatureFlags({
        experimentalViteRscServerReferences: false,
      }),
    ).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: true,
      shouldUseViteRscServerReferences: false,
    });
  });

  it("keeps the legacy server-reference transform available as env rollback", () => {
    vi.stubEnv("RWSDK_LEGACY_RSC_SERVER_REFERENCES", "1");

    expect(determineRscFeatureFlags()).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: true,
      shouldUseViteRscServerReferences: false,
    });
  });

  it("keeps the old experimental server-reference env disable as rollback", () => {
    vi.stubEnv("RWSDK_EXPERIMENTAL_VITE_RSC_SERVER_REFERENCES", "0");

    expect(determineRscFeatureFlags()).toEqual({
      shouldUseViteRscClientReferences: true,
      shouldUseViteRscManifestAdapter: true,
      shouldUseViteRscServerReferences: false,
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
