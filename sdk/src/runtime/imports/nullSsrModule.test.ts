import { describe, expect, it } from "vitest";
import { createNullSsrModule } from "./nullSsrModule";

describe("createNullSsrModule", () => {
  it("returns a null renderer for any manifest export name", () => {
    const module = createNullSsrModule() as any;

    expect(module.default()).toBe(null);
    expect(module.NamedButton()).toBe(null);
    expect(module["referenceKey#NamedButton"]()).toBe(null);
  });

  it("does not look like a thenable", () => {
    const module = createNullSsrModule() as any;

    expect(module.then).toBeUndefined();
    expect(module.catch).toBeUndefined();
    expect(module.finally).toBeUndefined();
  });
});
