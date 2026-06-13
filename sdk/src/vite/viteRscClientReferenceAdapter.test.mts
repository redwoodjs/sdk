import { describe, expect, it } from "vitest";
import {
  generateViteRscClientReferenceLookupEntries,
  normalizeViteRscClientReferenceId,
} from "./viteRscClientReferenceAdapter.mjs";

describe("generateViteRscClientReferenceLookupEntries", () => {
  it("generates legacy, importId, referenceKey, and export-specific lookup entries", () => {
    const entries = generateViteRscClientReferenceLookupEntries({
      projectRootDir: "/repo/app",
      legacyClientFiles: ["src/app/Client.tsx"],
      clientReferenceMetaMap: {
        "/repo/app/src/app/Client.tsx": {
          importId: "/repo/app/src/app/Client.tsx",
          referenceKey: "abc123",
          exportNames: ["default", "Named"],
        },
      },
    });

    expect(entries).toContainEqual({
      key: "src/app/Client.tsx",
      importId: "src/app/Client.tsx",
    });
    expect(entries).toContainEqual({
      key: "/repo/app/src/app/Client.tsx",
      importId: "/repo/app/src/app/Client.tsx",
    });
    expect(entries).toContainEqual({
      key: "abc123",
      importId: "/repo/app/src/app/Client.tsx",
    });
    expect(entries).toContainEqual({
      key: "abc123#Named",
      importId: "/repo/app/src/app/Client.tsx",
    });
    expect(entries).toContainEqual({
      key: "src/app/Client.tsx#default",
      importId: "/repo/app/src/app/Client.tsx",
    });
  });

  it("adds queryless lookup aliases for Vite HMR timestamped client reference ids", () => {
    const entries = generateViteRscClientReferenceLookupEntries({
      projectRootDir: "/repo/app",
      clientReferenceMetaMap: {
        "/repo/app/src/app/Client.tsx?t=123": {
          importId: "/repo/app/src/app/Client.tsx?t=123",
          referenceKey: "abc123",
          exportNames: ["Named"],
        },
      },
    });

    expect(entries).toContainEqual({
      key: "/repo/app/src/app/Client.tsx",
      importId: "/repo/app/src/app/Client.tsx?t=123",
    });
    expect(entries).toContainEqual({
      key: "src/app/Client.tsx#Named",
      importId: "/repo/app/src/app/Client.tsx?t=123",
    });
  });

  it("normalizes Windows-style ids and keeps duplicate basenames distinct", () => {
    const entries = generateViteRscClientReferenceLookupEntries({
      projectRootDir: "C:\\repo\\app",
      clientReferenceMetaMap: {
        "C:\\repo\\app\\src\\client\\a\\Duplicate.tsx": {
          importId: "C:\\repo\\app\\src\\client\\a\\Duplicate.tsx",
          referenceKey: "dupA",
          exportNames: ["Duplicate"],
        },
        "C:\\repo\\app\\src\\client\\b\\Duplicate.tsx": {
          importId: "C:\\repo\\app\\src\\client\\b\\Duplicate.tsx",
          referenceKey: "dupB",
          exportNames: ["Duplicate"],
        },
      },
    });

    expect(normalizeViteRscClientReferenceId("C:\\repo\\app\\x.tsx")).toBe(
      "c:/repo/app/x.tsx",
    );
    expect(entries).toContainEqual({
      key: "src/client/a/Duplicate.tsx#Duplicate",
      importId: "c:/repo/app/src/client/a/Duplicate.tsx",
    });
    expect(entries).toContainEqual({
      key: "src/client/b/Duplicate.tsx#Duplicate",
      importId: "c:/repo/app/src/client/b/Duplicate.tsx",
    });
  });

  it("preserves node_modules, symlink-style, and workspace package ids without basename collapsing", () => {
    const entries = generateViteRscClientReferenceLookupEntries({
      projectRootDir: "/repo/app",
      clientReferenceMetaMap: {
        "/repo/app/node_modules/@scope/ui/Button.tsx": {
          importId: "/repo/app/node_modules/@scope/ui/Button.tsx",
          referenceKey: "pkgRef",
          exportNames: ["Button"],
        },
        "/repo/packages/ui/src/Button.tsx": {
          importId: "/repo/packages/ui/src/Button.tsx",
          referenceKey: "workspaceRef",
          exportNames: ["Button"],
        },
        "/repo/app/src/linked/Button.tsx": {
          importId: "/repo/app/src/linked/Button.tsx",
          referenceKey: "symlinkRef",
          exportNames: ["Button"],
        },
        "/repo/packages/my_lib/src/client.mjs": {
          importId:
            "/repo/app/node_modules/.pnpm/ui-lib@file+packages+my_lib_react@19.0.0/node_modules/ui-lib/src/client.mjs",
          referenceKey: "pnpmFileRef",
          exportNames: ["Client"],
        },
      },
    });

    expect(entries).toContainEqual({
      key: "pkgRef#Button",
      importId: "/repo/app/node_modules/@scope/ui/Button.tsx",
    });
    expect(entries).toContainEqual({
      key: "workspaceRef#Button",
      importId: "/repo/packages/ui/src/Button.tsx",
    });
    expect(entries).toContainEqual({
      key: "src/linked/Button.tsx#Button",
      importId: "/repo/app/src/linked/Button.tsx",
    });
    expect(entries).toContainEqual({
      key: "/repo/packages/my_lib/src/client.mjs#Client",
      importId:
        "/repo/app/node_modules/.pnpm/ui-lib@file+packages+my_lib_react@19.0.0/node_modules/ui-lib/src/client.mjs",
    });
    expect(entries).toContainEqual({
      key: "pnpmFileRef#Client",
      importId:
        "/repo/app/node_modules/.pnpm/ui-lib@file+packages+my_lib_react@19.0.0/node_modules/ui-lib/src/client.mjs",
    });
  });
});
