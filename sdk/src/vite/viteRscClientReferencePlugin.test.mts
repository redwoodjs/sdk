import { describe, expect, it } from "vitest";
import { generateViteRscClientReferenceLookupCode } from "./viteRscClientReferencePlugin.mjs";

describe("generateViteRscClientReferenceLookupCode", () => {
  it("generates Redwood's virtual use-client lookup from vite-rsc metadata", () => {
    const code = generateViteRscClientReferenceLookupCode({
      projectRootDir: "/repo/app",
      clientReferenceMetaMap: {
        "/repo/app/src/app/client/Named.tsx": {
          importId: "/repo/app/src/app/client/Named.tsx",
          referenceKey: "hashNamed",
          exportNames: ["NamedButton", "NamedLabel"],
        },
      },
    });

    expect(code).toContain("export const useClientLookup = {");
    expect(code).toContain(
      '"hashNamed": () => import("/repo/app/src/app/client/Named.tsx")',
    );
    expect(code).toContain(
      '"src/app/client/Named.tsx#NamedButton": () => import("/repo/app/src/app/client/Named.tsx")',
    );
    expect(code).toContain(
      '"/src/app/client/Named.tsx#NamedLabel": () => import("/repo/app/src/app/client/Named.tsx")',
    );
  });
});
