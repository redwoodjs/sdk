import { describe, it, expect } from "vitest";
import { transformJsxScriptTagsCode } from "./transformJsxScriptTagsPlugin.mjs";

describe("transformJsxScriptTagsCode", () => {
  const mockManifest = {
    "src/client.tsx": { file: "assets/client-a1b2c3d4.js" },
    "src/entry.js": { file: "assets/entry-e5f6g7h8.js" },
    "src/styles.css": { file: "assets/styles-i9j0k1l2.css" },
  };

  it("transforms script src attributes in JSX", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("script", {
        src: "/assets/client-a1b2c3d4.js",
        type: "module"
      })
    `);
  });

  it("transforms link href attributes with preload rel", async () => {
    const code = `
      jsx("link", {
        rel: "preload",
        href: "/src/client.tsx",
        as: "script"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("link", {
        rel: "preload",
        href: "/assets/client-a1b2c3d4.js",
        as: "script"
      })
    `);
  });

  it("transforms link href attributes with modulepreload rel", async () => {
    const code = `
      jsx("link", {
        href: "/src/client.tsx",
        rel: "modulepreload"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("link", {
        href: "/assets/client-a1b2c3d4.js",
        rel: "modulepreload"
      })
    `);
  });

  it("returns null when no transformations are needed", async () => {
    const code = `
      jsx("div", { children: "No scripts or links here" })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(code);
  });

  it("handles paths not found in manifest", async () => {
    const code = `
      jsx("script", {
        src: "/src/non-existent.js",
        type: "module"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(code);
  });
});
