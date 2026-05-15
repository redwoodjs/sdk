import { describe, expect, it } from "vitest";
import { defineLinks } from "./links";

const link = defineLinks(["/", "/users/:id", "/files/*"] as const);

describe("link helpers", () => {
  it("returns static routes without parameters", () => {
    expect(link("/")).toBe("/");
  });

  it("replaces named parameters with encoded values", () => {
    expect(link("/users/:id", { id: "user id" })).toBe("/users/user%20id");
  });

  it("replaces wildcard parameters preserving path segments", () => {
    expect(link("/files/*", { $0: "docs/Guide Document.md" })).toBe(
      "/files/docs/Guide%20Document.md",
    );
  });

  it("throws when parameters are missing", () => {
    expect(() => link("/users/:id" as any)).toThrowError(
      /requires an object of parameters/i,
    );
  });

  it("throws when extra parameters are supplied", () => {
    expect(() =>
      link("/users/:id", { id: "123", extra: "value" } as any),
    ).toThrowError(/is not used by route/i);
  });
});
