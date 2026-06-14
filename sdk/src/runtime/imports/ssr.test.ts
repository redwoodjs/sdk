import { beforeEach, describe, expect, it, vi } from "vitest";

const clientModule = {
  NamedButton: () => null,
};

vi.mock("virtual:use-client-lookup.js", () => ({
  useClientLookup: {
    "/src/app/client/Named.tsx": () => Promise.resolve(clientModule),
  },
}));

describe("ssr imports", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exposes both full ids and export names for split client-reference requires", async () => {
    const { ssrWebpackRequire } = await import("./ssr");

    await expect(
      ssrWebpackRequire("/src/app/client/Named.tsx#NamedButton"),
    ).resolves.toEqual({
      "/src/app/client/Named.tsx#NamedButton": clientModule.NamedButton,
      NamedButton: clientModule.NamedButton,
    });
  });
});
