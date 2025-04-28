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

  it("transforms inline scripts with dynamic imports", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "import('/src/client.tsx').then(module => { console.log(module); })"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("script", {
        type: "module",
        children: "import(\\"\/assets\/client-a1b2c3d4.js\\").then(module => { console.log(module); })"
      })
    `);
  });

  it("transforms inline scripts with type=module", async () => {
    const code = `
      jsx("script", { type: "module", children: "import('/src/client.tsx')" })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("script", { type: "module", children: "import(\\"\/assets\/client-a1b2c3d4.js\\")" })
    `);
  });

  it("transforms inline scripts with multiline content", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: \`
          // Some comments here
          const init = async () => {
            await import('/src/entry.js');
            console.log('initialized');
          };
          init();
        \`
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("script", {
        type: "module",
        children: \`
          // Some comments here
          const init = async () => {
            await import("/assets/entry-e5f6g7h8.js");
            console.log('initialized');
          };
          init();
        \`
      })
    `);
  });

  it("transforms multiple imports in the same inline script", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: \`
          import('/src/client.tsx');
          import('/src/entry.js');
        \`
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("script", {
        type: "module",
        children: \`
          import("/assets/client-a1b2c3d4.js");
          import("/assets/entry-e5f6g7h8.js");
        \`
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

  it("transforms real-world Document component example", async () => {
    const code = `
      jsx("html", {
        lang: "en",
        children: [
          jsx("head", {
            children: [
              jsx("meta", { charSet: "utf-8" }),
              jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
              jsx("title", { children: "@redwoodjs/starter-standard" }),
              jsx("link", { rel: "modulepreload", href: "/src/client.tsx", as: "script" })
            ]
          }),
          jsx("body", {
            children: [
              jsx("div", { id: "root", children: props.children }),
              jsx("script", { children: 'import("/src/client.tsx")' })
            ]
          })
        ]
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`
      jsx("html", {
        lang: "en",
        children: [
          jsx("head", {
            children: [
              jsx("meta", { charSet: "utf-8" }),
              jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
              jsx("title", { children: "@redwoodjs/starter-standard" }),
              jsx("link", { rel: "modulepreload", href: "/assets/client-a1b2c3d4.js", as: "script" })
            ]
          }),
          jsx("body", {
            children: [
              jsx("div", { id: "root", children: props.children }),
              jsx("script", { children: "import(\\"\/assets\/client-a1b2c3d4.js\\")" })
            ]
          })
        ]
      })
    `);
  });

  it("returns null when no transformations are needed", async () => {
    const code = `
      jsx("div", { children: "No scripts or links here" })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result).toBeUndefined();
  });

  it("handles paths not found in manifest", async () => {
    const code = `
      jsx("script", {
        src: "/src/non-existent.js",
        type: "module"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(undefined);
  });
});
