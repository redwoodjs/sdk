import { describe, expect, it } from "vitest";
import {
  clientDirectiveLookupInvalidationTargets,
  extractImportSpecifiers,
  hasEntryAsAncestor,
  moduleImportsKnownClientFile,
  serverDirectiveLookupInvalidationTargets,
  shouldFullReloadForNewClientImport,
} from "./miniflareHMRPlugin.mjs";
import { VIRTUAL_SSR_PREFIX } from "./ssrVirtualModule.mjs";
import { RESOLVED_VIRTUAL_MODULE } from "./viteRscClientReferencePlugin.mjs";

interface MockModule {
  file: string;
  importers: Set<MockModule>;
  importedModules: Set<MockModule>;
}

const createModule = (file: string): MockModule => ({
  file,
  importers: new Set(),
  importedModules: new Set(),
});

describe("hasEntryAsAncestor", () => {
  it("should return true if the entry file is a direct importer", () => {
    const entry = createModule("entry.js");
    const mod = createModule("mod.js");
    mod.importers.add(entry);

    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      true,
    );
  });

  it("should return true if the entry file is an indirect importer", () => {
    const entry = createModule("entry.js");
    const importer1 = createModule("importer1.js");
    const mod = createModule("mod.js");

    importer1.importers.add(entry);
    mod.importers.add(importer1);

    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      true,
    );
  });

  it("should return false if the entry file is not an importer", () => {
    const entry = createModule("entry.js");
    const other = createModule("other.js");
    const mod = createModule("mod.js");

    mod.importers.add(other);

    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      false,
    );
  });

  it("should handle circular dependencies", () => {
    const entry = createModule("entry.js");
    const modA = createModule("modA.js");
    const modB = createModule("modB.js");

    modA.importers.add(entry);
    modA.importers.add(modB);
    modB.importers.add(modA);

    expect(hasEntryAsAncestor({ module: modB, entryFile: "entry.js" })).toBe(
      true,
    );
  });

  it("should return false for a module with no importers", () => {
    const mod = createModule("mod.js");
    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      false,
    );
  });
});

describe("extractImportSpecifiers", () => {
  it("extracts static, side-effect, export, and dynamic import specifiers", () => {
    expect(
      extractImportSpecifiers(`
        import React from "react";
        import "./style.css";
        export { Thing } from "./Thing";
        const Lazy = import("./Lazy");
      `),
    ).toEqual(["react", "./style.css", "./Thing", "./Lazy"]);
  });
});

// Path B for #1230: keep this lower-level decision coverage while the
// broader browser-level HMR/state-preservation fixture work remains tracked by
// #1228.
describe("shouldFullReloadForNewClientImport", () => {
  it("uses rsc:update instead of full reload when the changed file is itself a client module", () => {
    expect(
      shouldFullReloadForNewClientImport({
        hasClientDirective: true,
        nowImportsKnownClientFile: true,
        previouslyImportedKnownClientFile: false,
      }),
    ).toBe(false);
  });

  it("requests full reload only when a non-client worker module newly imports a client module", () => {
    expect(
      shouldFullReloadForNewClientImport({
        hasClientDirective: false,
        nowImportsKnownClientFile: true,
        previouslyImportedKnownClientFile: false,
      }),
    ).toBe(true);
    expect(
      shouldFullReloadForNewClientImport({
        hasClientDirective: false,
        nowImportsKnownClientFile: true,
        previouslyImportedKnownClientFile: true,
      }),
    ).toBe(false);
    expect(
      shouldFullReloadForNewClientImport({
        hasClientDirective: false,
        nowImportsKnownClientFile: false,
        previouslyImportedKnownClientFile: false,
      }),
    ).toBe(false);
  });
});

describe("directive lookup invalidation targets", () => {
  it("invalidates plugin-rsc client reference lookups when a use client boundary changes", () => {
    expect(clientDirectiveLookupInvalidationTargets("worker")).toEqual([
      { environment: "client", id: RESOLVED_VIRTUAL_MODULE },
      { environment: "ssr", id: RESOLVED_VIRTUAL_MODULE },
      { environment: "worker", id: RESOLVED_VIRTUAL_MODULE },
      {
        environment: "worker",
        id: `${VIRTUAL_SSR_PREFIX}/@id/virtual:use-client-lookup.js`,
      },
      {
        environment: "worker",
        id: `${VIRTUAL_SSR_PREFIX}virtual:use-client-lookup.js`,
      },
    ]);
  });

  it("invalidates server lookup modules when a use server boundary changes", () => {
    expect(serverDirectiveLookupInvalidationTargets("worker")).toEqual([
      { environment: "client", id: "virtual:use-server-lookup.js" },
      { environment: "ssr", id: "virtual:use-server-lookup.js" },
      { environment: "worker", id: "virtual:use-server-lookup.js" },
      {
        environment: "worker",
        id: `${VIRTUAL_SSR_PREFIX}/@id/virtual:use-server-lookup.js`,
      },
      {
        environment: "worker",
        id: `${VIRTUAL_SSR_PREFIX}virtual:use-server-lookup.js`,
      },
    ]);
  });
});

describe("moduleImportsKnownClientFile", () => {
  it("matches imported modules against normalized client files", () => {
    const mod = createModule("/repo/app/src/components/ComponentA.tsx");
    mod.importedModules.add(
      createModule("/repo/app/src/components/ComponentB.tsx"),
    );

    expect(
      moduleImportsKnownClientFile({
        module: mod,
        clientFiles: new Set(["/src/components/ComponentB.tsx"]),
        rootDir: "/repo/app",
      }),
    ).toBe(true);
  });

  it("returns false when the old graph did not import a known client file", () => {
    const mod = createModule("/repo/app/src/components/ComponentA.tsx");
    mod.importedModules.add(
      createModule("/repo/app/src/components/ServerOnly.tsx"),
    );

    expect(
      moduleImportsKnownClientFile({
        module: mod,
        clientFiles: new Set(["/src/components/ComponentB.tsx"]),
        rootDir: "/repo/app",
      }),
    ).toBe(false);
  });
});
