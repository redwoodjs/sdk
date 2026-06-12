import { describe, expect, it } from "vitest";
import { getLookupCandidates } from "./lookupCandidates";

describe("getLookupCandidates", () => {
  it("includes queryless aliases", () => {
    expect(getLookupCandidates("/src/app/client.tsx?t=123")).toEqual([
      "/src/app/client.tsx?t=123",
      "/src/app/client.tsx",
    ]);
  });

  it("includes pnpm file dependency source aliases", () => {
    expect(
      getLookupCandidates(
        "/node_modules/.pnpm/ui-lib@file+packages+ui-lib/node_modules/ui-lib/client.mjs",
      ),
    ).toContain("/packages/ui-lib/client.mjs");
  });
});
