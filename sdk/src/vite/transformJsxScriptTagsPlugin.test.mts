import { vi, test, expect, describe, beforeEach } from "vitest";
import {
  transformJsxScriptTagsCode,
  getDocumentEntryPoints,
  __test_only_resetDocumentEntryPoints,
} from "./transformJsxScriptTagsPlugin.mjs";
import type { ViteDevServer } from "vite";

describe("transformJsxScriptTagsCode", () => {
  const projectRootDir = "/path/to/project";
  const mockViteDevServer = {} as ViteDevServer;

  const mockManifest = {
    "src/client.tsx": { file: "assets/client-a1b2c3d4.js" },
    "src/entry.js": { file: "assets/entry-e5f6g7h8.js" },
    "src/styles.css": { file: "assets/styles-i9j0k1l2.css" },
    "src/other.ts": { file: "assets/other-a1b2c3d4.js" },
    "src/more.css": { file: "assets/more-i9j0k1l2.css" },
  };

  beforeEach(() => {
    __test_only_resetDocumentEntryPoints();
  });

  test("transforms script src attributes in JSX", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("finds and stores entry points from script tags", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;
    const docId = "test-doc.tsx";
    await transformJsxScriptTagsCode(
      docId,
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );

    const entryPoints = getDocumentEntryPoints(docId);
    expect(entryPoints).toEqual(new Set(["/src/client.tsx"]));
  });

  test("transforms inline scripts with dynamic imports", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "import('/src/client.tsx').then(module => { console.log(module); })"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("transforms inline scripts with type=module", async () => {
    const code = `
      jsx("script", { type: "module", children: "import('/src/client.tsx')" })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("transforms inline scripts with multiline content", async () => {
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
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("transforms multiple imports in the same inline script", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: \`
          import('/src/client.tsx');
          import('/src/entry.js');
        \`
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("transforms link href attributes with preload rel", async () => {
    const code = `
      jsx("link", {
        rel: "preload",
        href: "/src/client.tsx",
        as: "script"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("transforms link href attributes with modulepreload rel", async () => {
    const code = `
      jsx("link", {
        href: "/src/client.tsx",
        rel: "modulepreload"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("transforms real-world Document component example", async () => {
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
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("returns null when no transformations are needed", async () => {
    const code = `
      jsx("div", { children: "No scripts or links here" })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeUndefined();
  });

  test("handles paths not found in manifest", async () => {
    const code = `
      jsx("script", {
        src: "/src/non-existent.js",
        type: "module"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      mockManifest,
      projectRootDir,
      undefined,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("adds nonce to script tags with src attribute and imports requestInfo", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("adds nonce to script tags with string literal children", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("does not add nonce to script tags with dangerouslySetInnerHTML", async () => {
    const code = `
      jsx("script", {
        type: "module",
        dangerouslySetInnerHTML: { __html: "console.log('hello world')" }
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeUndefined();
  });

  test("does not add nonce to script tags that already have nonce", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "console.log('hello world')",
        nonce: "existing-nonce"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeUndefined();
  });

  test("uses existing requestInfo import if already present", async () => {
    const code = `
      import { foo } from 'bar';
      import { requestInfo, someOtherThing } from "rwsdk/worker";
      
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("adds requestInfo to existing SDK import if module already imported", async () => {
    const code = `
      import { foo } from 'bar';
      import { someOtherThing } from "rwsdk/worker";
      
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });

  test("works in development mode without a manifest", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;
    const result = await transformJsxScriptTagsCode(
      "test.tsx",
      code,
      {},
      projectRootDir,
      mockViteDevServer,
    );
    expect(result).toBeDefined();
    expect(result!.code).toMatchSnapshot();
  });
});
