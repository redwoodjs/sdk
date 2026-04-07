import { describe, expect, it } from "vitest";
import { findScriptForModule } from "./preloads";
import type { Manifest } from "../lib/manifest";

describe("findScriptForModule", () => {
  it("finds a direct entry module", () => {
    const manifest: Manifest = {
      "src/client.tsx": {
        file: "assets/client-abc123.js",
        isEntry: true,
      },
    };
    const result = findScriptForModule("/src/client.tsx", manifest);
    expect(result?.file).toBe("assets/client-abc123.js");
  });

  it("finds a dynamic entry module", () => {
    const manifest: Manifest = {
      "src/pages/editor.tsx": {
        file: "assets/editor-def456.js",
        isDynamicEntry: true,
      },
    };
    const result = findScriptForModule("/src/pages/editor.tsx", manifest);
    expect(result?.file).toBe("assets/editor-def456.js");
  });

  it("follows imports to find the entry", () => {
    const manifest: Manifest = {
      "src/components/Button.tsx": {
        file: "assets/button-abc.js",
        imports: ["src/lib/utils.ts"],
      },
      "src/lib/utils.ts": {
        file: "assets/utils-def.js",
        isEntry: true,
      },
    };
    const result = findScriptForModule("/src/components/Button.tsx", manifest);
    expect(result?.file).toBe("assets/utils-def.js");
  });

  it("returns undefined for missing modules", () => {
    const manifest: Manifest = {};
    const result = findScriptForModule("/src/missing.tsx", manifest);
    expect(result).toBeUndefined();
  });

  it("handles circular imports without infinite loop", () => {
    const manifest: Manifest = {
      "src/a.ts": {
        file: "assets/a.js",
        imports: ["src/b.ts"],
      },
      "src/b.ts": {
        file: "assets/b.js",
        imports: ["src/a.ts"],
      },
    };
    const result = findScriptForModule("/src/a.ts", manifest);
    expect(result).toBeUndefined();
  });

  it("strips leading slash from id to match manifest keys", () => {
    const manifest: Manifest = {
      "src/client.tsx": {
        file: "assets/client.js",
        isEntry: true,
      },
    };
    // Module IDs from scriptsToBeLoaded have leading slashes
    expect(findScriptForModule("/src/client.tsx", manifest)?.file).toBe(
      "assets/client.js",
    );
    // Should also work without leading slash
    expect(findScriptForModule("src/client.tsx", manifest)?.file).toBe(
      "assets/client.js",
    );
  });
});
