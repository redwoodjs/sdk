import { describe, expect, it } from "vitest";
import { getLookupCandidates } from "./lookupCandidates";

describe("getLookupCandidates", () => {
  it("includes queryless aliases", () => {
    expect(getLookupCandidates("/src/app/client.tsx?t=123")).toEqual([
      "/src/app/client.tsx?t=123",
      "/src/app/client.tsx",
    ]);
  });

  it("does not reverse-engineer pnpm file dependency aliases at runtime", () => {
    expect(
      getLookupCandidates(
        "/node_modules/.pnpm/ui-lib@file+packages+my_lib_react@19.0.0/node_modules/ui-lib/client.mjs",
      ),
    ).toEqual([
      "/node_modules/.pnpm/ui-lib@file+packages+my_lib_react@19.0.0/node_modules/ui-lib/client.mjs",
    ]);
  });
});
