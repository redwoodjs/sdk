import { describe, expect, it } from "vitest";
import { generateViteRscServerReferenceLookupCode } from "./viteRscServerReferenceLookupPlugin.mjs";

describe("generateViteRscServerReferenceLookupCode", () => {
  it("generates Redwood's virtual use-server lookup from vite-rsc metadata", () => {
    const code = generateViteRscServerReferenceLookupCode({
      projectRootDir: "/repo/app",
      serverFiles: ["/src/app/legacyActions.ts"],
      serverReferenceMetaMap: {
        "/repo/app/src/app/actions.ts": {
          importId: "/repo/app/src/app/actions.ts",
          referenceKey: "hashAction",
          exportNames: ["addTodoAction"],
        },
      },
    });

    expect(code).toContain("export const useServerLookup = {");
    expect(code).toContain(
      '"/src/app/legacyActions.ts": () => import("/src/app/legacyActions.ts")',
    );
    expect(code).toContain(
      '"hashAction": () => import("/repo/app/src/app/actions.ts")',
    );
    expect(code).toContain(
      '"src/app/actions.ts#addTodoAction": () => import("/repo/app/src/app/actions.ts")',
    );
  });

  it("uses the vendor server barrel for node_modules entries in dev", () => {
    const code = generateViteRscServerReferenceLookupCode({
      projectRootDir: "/repo/app",
      isDev: true,
      serverFiles: [
        "/node_modules/.pnpm/server-lib@file+packages+server-lib/node_modules/server-lib/actions.mjs",
      ],
      serverReferenceMetaMap: {},
    });

    expect(code).toContain(
      '"/node_modules/.pnpm/server-lib@file+packages+server-lib/node_modules/server-lib/actions.mjs": () => import("rwsdk/__vendor_server_barrel").then(m => m.default["/node_modules/.pnpm/server-lib@file+packages+server-lib/node_modules/server-lib/actions.mjs"])',
    );
  });
});
