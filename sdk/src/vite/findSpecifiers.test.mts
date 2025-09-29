import { describe, expect, it } from "vitest";
import { findExports, findImportSpecifiers } from "./findSpecifiers.mjs";

function dedupeImports(imports: Array<{ s: number; e: number; raw: string }>) {
  const seen = new Set<string>();
  return imports.filter((imp) => {
    const key = `${imp.s}:${imp.e}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

describe("findSpecifiers", () => {
  describe("findImportSpecifiers", () => {
    it("should find various import types", () => {
      const code = `
        import { a } from "module-a";
        import b from 'module-b';
        import * as c from "module-c";
        import "module-d";
        const e = import('module-e');
        const f = require("module-f");
      `;
      const results = findImportSpecifiers("test.ts", code, []);
      const specifiers = dedupeImports(results).map((r) => r.raw);
      expect(specifiers).toEqual([
        "module-a",
        "module-c",
        "module-b",
        "module-d",
        "module-e",
        "module-f",
      ]);
    });

    it("should find re-exports", () => {
      const code = `
        export { a } from "module-a";
        export * from 'module-b';
      `;
      const results = findImportSpecifiers("test.ts", code, []);
      const specifiers = dedupeImports(results).map((r) => r.raw);
      expect(specifiers).toEqual(["module-a", "module-b"]);
    });

    it("should ignore specified patterns", () => {
      const code = `
        import { a } from "module-a";
        import b from 'module-b';
        import c from "ignored-module";
      `;
      const results = findImportSpecifiers("test.ts", code, [/ignored/]);
      const specifiers = dedupeImports(results).map((r) => r.raw);
      expect(specifiers).toEqual(["module-a", "module-b"]);
    });

    it("should ignore virtual modules", () => {
      const code = `import a from "virtual:my-virtual-module";`;
      const results = findImportSpecifiers("test.ts", code, []);
      expect(results).toHaveLength(0);
    });

    it("should ignore __rwsdknossr modules", () => {
      const code = `import a from "some-module?__rwsdknossr";`;
      const results = findImportSpecifiers("test.ts", code, []);
      expect(results).toHaveLength(0);
    });

    it("should handle tsx files", () => {
      const code = `
        import React from 'react';
        const App = () => <div>Hello</div>;
        export default App;
      `;
      const results = findImportSpecifiers("test.tsx", code, []);
      const specifiers = dedupeImports(results).map((r) => r.raw);
      expect(specifiers).toEqual(["react"]);
    });

    it("should return correct positions", () => {
      const code = `import { a } from "module-a";`;
      const results = findImportSpecifiers("test.ts", code, []);
      const deduped = dedupeImports(results);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].s).toBe(19);
      expect(deduped[0].e).toBe(27);
      expect(code.substring(deduped[0].s, deduped[0].e)).toBe("module-a");
    });
  });

  describe("findExports", () => {
    it("should find named exports (const, let, function)", () => {
      const code = `
        export const a = 1;
        export let b = 2;
        export function c() {}
        export async function d() {}
      `;
      const results = findExports("test.ts", code);
      expect(results).toEqual([
        { name: "a", isDefault: false },
        { name: "b", isDefault: false },
        { name: "c", isDefault: false },
        { name: "d", isDefault: false },
      ]);
    });

    it("should find default exports", () => {
      const code = `
        export default function myFunc() {}
        const b = 1;
        export default b;
      `;
      const results = findExports("test.ts", code);
      expect(results).toEqual([
        { name: "myFunc", isDefault: true },
        { name: "default", isDefault: true },
      ]);
    });

    it("should find export declarations", () => {
      const code = `
        const a = 1;
        const b = 2;
        export { a, b as c };
      `;
      const results = findExports("test.ts", code);
      expect(results).toEqual([
        {
          name: "a",
          isDefault: false,
          alias: undefined,
          originalName: "a",
        },
        {
          name: "c",
          isDefault: false,
          alias: "c",
          originalName: "b",
        },
      ]);
    });

    it("should find re-exports", () => {
      const code = `
        export { a, b as c } from 'module-a';
        export { default as d } from 'module-b';
      `;
      const results = findExports("test.ts", code);
      expect(results).toEqual([
        {
          name: "a",
          isDefault: false,
          alias: undefined,
          originalName: "a",
          isReExport: true,
          moduleSpecifier: "module-a",
        },
        {
          name: "c",
          isDefault: false,
          alias: "c",
          originalName: "b",
          isReExport: true,
          moduleSpecifier: "module-a",
        },
        {
          name: "d",
          isDefault: true,
          alias: "d",
          originalName: "default",
          isReExport: true,
          moduleSpecifier: "module-b",
        },
        {
          alias: undefined,
          isDefault: false,
          name: "a",
          originalName: "a",
        },
        {
          alias: "c",
          isDefault: false,
          name: "c",
          originalName: "b",
        },
        {
          alias: "d",
          isDefault: true,
          name: "d",
          originalName: "default",
        },
      ]);
    });

    it("should handle mixed exports", () => {
      const code = `
        export const a = 1;
        export default function b() {}
        const c = 3;
        export { c };
      `;
      const results = findExports("test.tsx", code);
      expect(results).toEqual([
        { name: "a", isDefault: false },
        { name: "b", isDefault: true },
        { isDefault: true, name: "default" },
        { name: "c", isDefault: false, originalName: "c", alias: undefined },
      ]);
    });
  });
});
