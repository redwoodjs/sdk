import { describe, expect, it } from "vitest";
import { hasServerPassthroughClientExport } from "./viteRscClientReferencePassthroughPlugin.mjs";

describe("hasServerPassthroughClientExport", () => {
  it("detects lowercase named exports in use-client modules", () => {
    expect(
      hasServerPassthroughClientExport(
        "/src/app/client.tsx",
        `"use client";\nexport const appClientUtil = { format: () => "ok" };\nexport function AppButton() { return null; }`,
      ),
    ).toBe(true);
  });

  it("detects known server-safe package components", () => {
    expect(
      hasServerPassthroughClientExport(
        "/node_modules/@mantine/core/esm/index.mjs",
        `"use client";\nexport function ColorSchemeScript() { return null; }`,
      ),
    ).toBe(true);
  });

  it("detects uppercase non-component constants", () => {
    expect(
      hasServerPassthroughClientExport(
        "/src/app/constants.ts",
        `"use client";\nexport const THEME_CONFIG = { color: "red" };`,
      ),
    ).toBe(true);
  });

  it("detects default object and array exports as passthrough", () => {
    expect(
      hasServerPassthroughClientExport(
        "/src/app/config.ts",
        `"use client";\nexport default { color: "red" };`,
      ),
    ).toBe(true);
    expect(
      hasServerPassthroughClientExport(
        "/src/app/list.ts",
        `"use client";\nexport default ["red", "blue"];`,
      ),
    ).toBe(true);
  });

  it("does not mark component-only modules as server passthrough", () => {
    expect(
      hasServerPassthroughClientExport(
        "/src/app/Button.tsx",
        `"use client";\nexport function AppButton() { return null; }\nexport default function DefaultButton() { return null; }`,
      ),
    ).toBe(false);
  });

  it("does not mark identifier default component exports as passthrough", () => {
    expect(
      hasServerPassthroughClientExport(
        "/src/app/Button.tsx",
        `"use client";\nfunction Button() { return null; }\nexport default Button;`,
      ),
    ).toBe(false);
  });
});
