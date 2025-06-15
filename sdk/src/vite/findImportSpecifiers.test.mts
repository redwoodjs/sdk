import { describe, it, expect } from "vitest";
import { findExports } from "./findImportSpecifiers.mjs";

describe("findExports", () => {
  it("finds named exports", () => {
    const code = `
export const Component = () => {};
export function helper() {}
export let data = {};
`;
    const exports = findExports("/test.tsx", code);

    // Just check that we found the exports, order doesn't matter for our use case
    const names = exports.map((e) => e.name).sort();
    expect(names).toEqual(["Component", "data", "helper"]);

    // Check that none are default
    expect(exports.every((e) => !e.isDefault)).toBe(true);
  });

  it("finds default exports", () => {
    const code = `
export default function Component() {}
`;
    const exports = findExports("/test.tsx", code);

    // Should find at least one default export
    const defaultExports = exports.filter((e) => e.isDefault);
    expect(defaultExports.length).toBeGreaterThan(0);
    expect(defaultExports.some((e) => e.name === "Component")).toBe(true);
  });

  it("finds export declarations", () => {
    const code = `
const First = () => {};
const Second = () => {};
export { First, Second };
`;
    const exports = findExports("/test.tsx", code);
    const names = exports.map((e) => e.name).sort();
    expect(names).toEqual(["First", "Second"]);
  });

  it("finds export declarations with aliases", () => {
    const code = `
const Component = () => {};
export { Component as MyComponent };
`;
    const exports = findExports("/test.tsx", code);
    expect(exports.some((e) => e.name === "MyComponent")).toBe(true);
  });

  it("finds re-exports", () => {
    const code = `
export { sum } from './math';
export { default as multiply } from './multiply';
`;
    const exports = findExports("/test.tsx", code);

    // Should find re-exports
    const reExports = exports.filter((e) => e.isReExport);
    expect(reExports.length).toBeGreaterThan(0);

    const names = reExports.map((e) => e.name).sort();
    expect(names).toContain("sum");
    expect(names).toContain("multiply");
  });

  it("handles mixed export styles", () => {
    const code = `
export const First = () => {};
const Second = () => {};
export default function Main() {}
export { Second };
`;
    const exports = findExports("/test.tsx", code);

    const names = exports.map((e) => e.name);
    expect(names).toContain("First");
    expect(names).toContain("Second");

    // Should have at least one default export
    const defaultExports = exports.filter((e) => e.isDefault);
    expect(defaultExports.length).toBeGreaterThan(0);
  });
});
