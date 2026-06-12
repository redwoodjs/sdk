import { describe, expect, it } from "vitest";
import {
  collectRedwoodServerReferenceMetadata,
  collectRedwoodServerReferenceReExports,
  rewritePluginRscServerReferences,
} from "./viteRscServerReferenceBridgePlugin.mjs";

describe("viteRscServerReferenceBridgePlugin", () => {
  it("collects Redwood serverAction/serverQuery metadata", () => {
    const metadata = collectRedwoodServerReferenceMetadata(
      `"use server";
       import { serverAction, serverQuery } from "rwsdk/worker";
       export const getGreeting = serverQuery(async () => "hi");
       export const saveGreeting = serverAction(async () => "saved");
       export default serverQuery(async () => "default", { method: "POST" });`,
      "/src/app/functions.ts",
    );

    expect(metadata).toEqual(
      expect.arrayContaining([
        {
          moduleId: "/src/app/functions.ts",
          exportName: "default",
          source: "query",
          method: "POST",
        },
        {
          moduleId: "/src/app/functions.ts",
          exportName: "getGreeting",
          source: "query",
          method: "GET",
        },
        {
          moduleId: "/src/app/functions.ts",
          exportName: "saveGreeting",
          source: "action",
          method: "POST",
        },
      ]),
    );
    expect(metadata).toHaveLength(3);
  });

  it("collects use-server re-export metadata links", () => {
    const metadata = collectRedwoodServerReferenceReExports(
      `"use server";
       export { getGreeting as getGreetingReExported, saveGreeting } from "./actions";`,
      "/src/app/actionReexports.ts",
    );

    expect(metadata).toEqual([
      {
        exportName: "getGreetingReExported",
        originalName: "getGreeting",
        moduleSpecifier: "./actions",
      },
      {
        exportName: "saveGreeting",
        originalName: "saveGreeting",
        moduleSpecifier: "./actions",
      },
    ]);
  });

  it("rewrites plugin-rsc native server references to Redwood-compatible references", () => {
    const rewritten = rewritePluginRscServerReferences({
      code: `import * as $$ReactClient from "@vitejs/plugin-rsc/react/browser";
export const getGreeting = $$ReactClient.createServerReference("abc123#getGreeting", $$ReactClient.callServer, undefined, undefined, "getGreeting");`,
      environmentName: "client",
      metadataByKey: new Map([
        [
          "/src/app/functions.ts#getGreeting",
          {
            moduleId: "/src/app/functions.ts",
            exportName: "getGreeting",
            source: "query",
            method: "GET",
          },
        ],
      ]),
      referenceKeyToModuleId: new Map([["abc123", "/src/app/functions.ts"]]),
    });

    expect(rewritten).toContain(
      'createRedwoodServerReference("/src/app/functions.ts", "getGreeting", { method: "GET", source: "query" })',
    );
  });

  it("adds Redwood method/source args to plugin-rsc output normalized by the runtime bridge", () => {
    const rewritten = rewritePluginRscServerReferences({
      code: `import { createServerReference } from "rwsdk/client";
export let getGreeting = createServerReference("/src/app/functions.ts", "getGreeting");`,
      environmentName: "client",
      metadataByKey: new Map([
        [
          "/src/app/functions.ts#getGreeting",
          {
            moduleId: "/src/app/functions.ts",
            exportName: "getGreeting",
            source: "query",
            method: "GET",
          },
        ],
      ]),
      referenceKeyToModuleId: new Map(),
    });

    expect(rewritten).toContain(
      'createServerReference("/src/app/functions.ts", "getGreeting", "GET", "query")',
    );
  });
});
