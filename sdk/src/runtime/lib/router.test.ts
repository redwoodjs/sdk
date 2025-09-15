import { describe, it, expect } from "vitest";

import { matchPath } from "./router";

describe("matchPath", () => {
  // Test case 1: Static paths
  it("should match static paths", () => {
    expect(matchPath("/about/", "/about/")).toEqual({});
    expect(matchPath("/contact/", "/contact/")).toEqual({});
  });

  it("should not match different static paths", () => {
    expect(matchPath("/about/", "/service/")).toBeNull();
  });

  // Test case 2: Paths with parameters
  it("should match paths with parameters and extract them", () => {
    expect(matchPath("/users/:id/", "/users/123/")).toEqual({ id: "123" });
    expect(
      matchPath("/posts/:category/:slug/", "/posts/tech/my-first-post/"),
    ).toEqual({ category: "tech", slug: "my-first-post" });
  });

  it("should not match if parameter is missing", () => {
    expect(matchPath("/users/:id/", "/users/")).toBeNull();
  });

  // Test case 3: Paths with wildcards
  it("should match paths with wildcards and extract them", () => {
    expect(matchPath("/files/*/", "/files/document.pdf/")).toEqual({
      $0: "document.pdf",
    });
    expect(matchPath("/data/*/content/", "/data/archive/content/")).toEqual({
      $0: "archive",
    });
    expect(matchPath("/assets/*/*/", "/assets/images/pic.png/")).toEqual({
      $0: "images",
      $1: "pic.png",
    });
  });

  it("should match empty wildcard", () => {
    expect(matchPath("/files/*/", "/files//")).toEqual({ $0: "" });
  });

  // Test case 4: Paths with both parameters and wildcards
  it("should match paths with both parameters and wildcards", () => {
    expect(
      matchPath("/products/:productId/*/", "/products/abc/details/more/"),
    ).toEqual({ productId: "abc", $0: "details/more" });
  });

  // Test case 5: Paths that don't match
  it("should return null for non-matching paths", () => {
    expect(matchPath("/specific/path/", "/a/different/path/")).toBeNull();
  });

  // Test case 6: Edge cases
  it("should handle trailing slashes correctly", () => {
    // Current implementation in defineRoutes adds a trailing slash if missing,
    // and route() function also enforces it. matchPath itself doesn't normalize.
    expect(matchPath("/path/", "/path")).toBeNull(); // Path to match must end with /
    expect(matchPath("/path/", "/path/")).toEqual({});
  });

  it("should handle paths with multiple parameters and wildcards interspersed", () => {
    expect(
      matchPath(
        "/type/:typeId/item/*/:itemId/*/",
        "/type/a/item/image/b/thumb/",
      ),
    ).toEqual({ typeId: "a", $0: "image", itemId: "b", $1: "thumb" });
  });

  it("should not allow named parameters or wildcards in the same path", () => {
    expect(() =>
      matchPath("/type/:typeId:is:broken", "/type/a-thumb-drive"),
    ).toThrow();

    expect(() => matchPath("/type/**", "/type/a-thumb-drive")).toThrow();
  });
});
