import { describe, expect, it } from "vitest";
import { findSsrImportCallSites } from "./findSsrSpecifiers.mjs";

describe("findSsrImportCallSites", () => {
  it("should find __vite_ssr_import__ with double quotes", () => {
    const code = `const a = __vite_ssr_import__("module-a");`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      start: 10,
      end: 41,
      specifier: "module-a",
      kind: "import",
    });
  });

  it("should find __vite_ssr_import__ with single quotes", () => {
    const code = `const a = __vite_ssr_import__('module-a');`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      start: 10,
      end: 41,
      specifier: "module-a",
      kind: "import",
    });
  });

  it("should find __vite_ssr_dynamic_import__ with double quotes", () => {
    const code = `const a = __vite_ssr_dynamic_import__("module-a");`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      start: 10,
      end: 49,
      specifier: "module-a",
      kind: "dynamic_import",
    });
  });

  it("should find __vite_ssr_dynamic_import__ with single quotes", () => {
    const code = `const a = __vite_ssr_dynamic_import__('module-a');`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      start: 10,
      end: 49,
      specifier: "module-a",
      kind: "dynamic_import",
    });
  });

  it("should find calls with additional arguments", () => {
    const code = `const a = __vite_ssr_import__('module-a', { ssr: true });`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      start: 10,
      end: 56,
      specifier: "module-a",
      kind: "import",
    });
  });

  it("should find a mix of different calls", () => {
    const code = `
      const a = __vite_ssr_import__("module-a");
      const b = __vite_ssr_dynamic_import__('module-b');
    `;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(2);
    expect(results).toEqual(
      expect.arrayContaining([
        {
          start: 17,
          end: 48,
          specifier: "module-a",
          kind: "import",
        },
        {
          start: 66,
          end: 105,
          specifier: "module-b",
          kind: "dynamic_import",
        },
      ]),
    );
  });

  it("should return correct ranges for replacement", () => {
    const code = `__vite_ssr_import__("module-a")`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(1);
    const { start, end } = results[0];
    expect(code.substring(start, end)).toBe('__vite_ssr_import__("module-a")');
  });

  it("should return an empty array when no calls are found", () => {
    const code = `import a from "module-a";`;
    const results = findSsrImportCallSites("test.ts", code);
    expect(results).toHaveLength(0);
  });

  it("should handle tsx files correctly", () => {
    const code = `const a = () => <div>{__vite_ssr_import__("module-a")}</div>;`;
    const results = findSsrImportCallSites("test.tsx", code);
    expect(results).toHaveLength(1);
    expect(results[0].specifier).toBe("module-a");
  });
});
