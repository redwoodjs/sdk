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

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
              jsx("script", {
        src: "/assets/client-a1b2c3d4.js",
        type: "module",
          nonce: requestInfo.rw.nonce
    })
            )
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

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
              jsx("script", {
        type: "module",
        children: "import('/assets/client-a1b2c3d4.js').then(module => { console.log(module); })",
          nonce: requestInfo.rw.nonce
    })
            )
    `);
  });

  it("transforms inline scripts with type=module", async () => {
    const code = `
      jsx("script", { type: "module", children: "import('/src/client.tsx')" })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
              jsx("script", { type: "module", children: "import('/assets/client-a1b2c3d4.js')",
          nonce: requestInfo.rw.nonce
    })
            )
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

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/entry.js")),
              jsx("script", {
        type: "module",
        children: \`
          // Some comments here
          const init = async () => {
            await import('/assets/entry-e5f6g7h8.js');
            console.log('initialized');
          };
          init();
        \`,
          nonce: requestInfo.rw.nonce
    })
            )
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

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
(requestInfo.rw.scriptsToBeLoaded.add("/src/entry.js")),
              jsx("script", {
        type: "module",
        children: \`
          import('/assets/client-a1b2c3d4.js');
          import('/assets/entry-e5f6g7h8.js');
        \`,
          nonce: requestInfo.rw.nonce
    })
            )
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

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

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
              (
                              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
                              jsx("script", { children: "import(\\"\/assets\/client-a1b2c3d4.js\\")",
                                  nonce: requestInfo.rw.nonce
                            })
                            )
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

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/non-existent.js")),
              jsx("script", {
        src: "/src/non-existent.js",
        type: "module",
          nonce: requestInfo.rw.nonce
    })
            )
    `);
  });

  it("adds nonce to script tags with src attribute and imports requestInfo", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
              jsx("script", {
        src: "/assets/client-a1b2c3d4.js",
        type: "module",
          nonce: requestInfo.rw.nonce
    })
            )
    `);
  });

  it("adds nonce to script tags with string literal children", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, {});

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      jsx("script", {
        type: "module",
        children: "console.log('hello world')",
          nonce: requestInfo.rw.nonce
    })
    `);
  });

  it("does not add nonce to script tags with dangerouslySetInnerHTML", async () => {
    const code = `
      jsx("script", {
        type: "module",
        dangerouslySetInnerHTML: { __html: "console.log('hello world')" }
      })
    `;

    const result = await transformJsxScriptTagsCode(code, {});

    expect(result?.code).toEqual(undefined);
  });

  it("does not add nonce to script tags that already have nonce", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "console.log('hello world')",
        nonce: "existing-nonce"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, {});

    expect(result?.code).toEqual(undefined);
  });

  it("uses existing requestInfo import if already present", async () => {
    const code = `
      import { foo } from 'bar';
      import { requestInfo, someOtherThing } from "rwsdk/worker";
      
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, {});

    expect(result?.code).toEqual(`
      import { foo } from 'bar';
      import { requestInfo, someOtherThing } from "rwsdk/worker";
      
      jsx("script", {
        type: "module",
        children: "console.log('hello world')",
          nonce: requestInfo.rw.nonce
    })
    `);

    // Ensure we didn't duplicate the import
    const importCount = (result?.code.match(/from "rwsdk\/worker"/g) || [])
      .length;
    expect(importCount).toBe(1);
  });

  it("adds requestInfo to existing SDK import if module already imported", async () => {
    const code = `
      import { foo } from 'bar';
      import { someOtherThing } from "rwsdk/worker";
      
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;

    const result = await transformJsxScriptTagsCode(code, {});

    expect(result?.code).toEqual(`
      import { foo } from 'bar';
      import { someOtherThing, requestInfo } from "rwsdk/worker";
      
      jsx("script", {
        type: "module",
        children: "console.log('hello world')",
          nonce: requestInfo.rw.nonce
    })
    `);
  });

  it("works in development mode without a manifest", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;

    // Call without providing manifest (simulating dev mode)
    const result = await transformJsxScriptTagsCode(code);

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";

      (
              (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
              jsx("script", {
        src: "/src/client.tsx",
        type: "module",
          nonce: requestInfo.rw.nonce
    })
            )
    `);
  });

  it("regression favicon links", async () => {
    const styles = "./index.css?url";
    const code = `
    import { jsxDEV } from "react/jsx-dev-runtime";
import styles from "./index.css?url";
export const Document = ({
  children
}) => /* @__PURE__ */ jsxDEV("html", { lang: "en", children: [
  /* @__PURE__ */ jsxDEV("head", { children: [
    /* @__PURE__ */ jsxDEV("meta", { charSet: "utf-8" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 8,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 9,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("title", { children: "rwsdk-guestbook" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 10,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 11,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV(
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
      },
      void 0,
      false,
      {
        fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
        lineNumber: 12,
        columnNumber: 4
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      "link",
      {
        href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap",
        rel: "stylesheet"
      },
      void 0,
      false,
      {
        fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
        lineNumber: 17,
        columnNumber: 4
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("script", { src: "/theme-script.js" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 21,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "icon", href: "/favicon.svg" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 22,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "modulepreload", href: "/src/client.tsx" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 23,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "stylesheet", href: styles }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 24,
      columnNumber: 4
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
    lineNumber: 7,
    columnNumber: 3
  }, this),
  /* @__PURE__ */ jsxDEV("body", { children: [
    /* @__PURE__ */ jsxDEV("div", { id: "root", children }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 27,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("script", { children: 'import("/src/client.tsx")' }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 28,
      columnNumber: 4
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
    lineNumber: 26,
    columnNumber: 3
  }, this)
] }, void 0, true, {
  fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
  lineNumber: 6,
  columnNumber: 2
}, this);
`;
    const result = await transformJsxScriptTagsCode(code, mockManifest);

    expect(result?.code).toEqual(`import { requestInfo } from "rwsdk/worker";
import styles from "./index.css?url";
export const Document = ({
  children
}) => /* @__PURE__ */ jsxDEV("html", { lang: "en", children: [
  /* @__PURE__ */ jsxDEV("head", { children: [
    /* @__PURE__ */ jsxDEV("meta", { charSet: "utf-8" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 8,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 9,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("title", { children: "rwsdk-guestbook" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 10,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 11,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV(
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
      },
      void 0,
      false,
      {
        fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
        lineNumber: 12,
        columnNumber: 4
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      "link",
      {
        href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap",
        rel: "stylesheet"
      },
      void 0,
      false,
      {
        fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
        lineNumber: 17,
        columnNumber: 4
      },
      this
    ),
    (
                      (requestInfo.rw.scriptsToBeLoaded.add("/theme-script.js")),
                      /* @__PURE__ */ jsxDEV("script", { src: "/theme-script.js",
                            nonce: requestInfo.rw.nonce
                      }, void 0, false, {
        fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
        lineNumber: 21,
        columnNumber: 4
      }, this)
                    ),
    /* @__PURE__ */ jsxDEV("link", { rel: "icon", href: "/favicon.svg" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 22,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "modulepreload", href: "/assets/client-a1b2c3d4.js" }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 23,
      columnNumber: 4
    }, this),
    /* @__PURE__ */ jsxDEV("link", { rel: "stylesheet", href: styles }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 24,
      columnNumber: 4
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
    lineNumber: 7,
    columnNumber: 3
  }, this),
  /* @__PURE__ */ jsxDEV("body", { children: [
    /* @__PURE__ */ jsxDEV("div", { id: "root", children }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
      lineNumber: 27,
      columnNumber: 4
    }, this),
    (
                      (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
                      /* @__PURE__ */ jsxDEV("script", { children: "import(\\"/assets/client-a1b2c3d4.js\\")",
                          nonce: requestInfo.rw.nonce
                    }, void 0, false, {
        fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
        lineNumber: 28,
        columnNumber: 4
      }, this)
                    )
  ] }, void 0, true, {
    fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
    lineNumber: 26,
    columnNumber: 3
  }, this)
] }, void 0, true, {
  fileName: "/Users/justin/rw/blotter/rwsdk-guestbook/src/app/document/Document.tsx",
  lineNumber: 6,
  columnNumber: 2
}, this);`);
  });
});
