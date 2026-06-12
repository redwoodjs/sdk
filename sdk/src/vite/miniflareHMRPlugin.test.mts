import { describe, expect, it } from "vitest";
import {
  extractImportSpecifiers,
  hasEntryAsAncestor,
  moduleImportsKnownClientFile,
} from "./miniflareHMRPlugin.mjs";

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
