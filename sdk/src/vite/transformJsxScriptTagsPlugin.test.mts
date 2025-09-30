import jsBeautify from "js-beautify";
import { beforeEach, describe, expect, it } from "vitest";
import stubEnvVars from "../lib/testUtils/stubEnvVars.mjs";
import { transformJsxScriptTagsCode } from "./transformJsxScriptTagsPlugin.mjs";

// Helper function to normalize code formatting for test comparisons
function normalizeCode(code: string): string {
  return jsBeautify(code, { indent_size: 2 });
}

stubEnvVars();

beforeEach(() => {
  process.env.RWSDK_BUILD_PASS = "worker";
});

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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/Users/justin/rw/forks/workers-sdk/sdk/sdk",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
jsx("script", {
src: "rwsdk_asset:/src/client.tsx",
type: "module",
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("transforms inline scripts with dynamic imports", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "import('/src/client.tsx').then(module => { console.log(module); })"
      })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
jsx("script", {
type: "module",
children: "import('rwsdk_asset:/src/client.tsx').then(module => { console.log(module); })",
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("transforms inline scripts with type=module", async () => {
    const code = `
      jsx("script", { type: "module", children: "import('/src/client.tsx')" })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
jsx("script", { type: "module", children: "import('rwsdk_asset:/src/client.tsx')",
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/entry.js")),
jsx("script", {
type: "module",
children: \`
          // Some comments here
          const init = async () => {
            await import('rwsdk_asset:/src/entry.js');
            console.log('initialized');
          };
          init();
        \`,
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
(requestInfo.rw.scriptsToBeLoaded.add("/src/entry.js")),
jsx("script", {
type: "module",
children: \`
import('rwsdk_asset:/src/client.tsx');
import('rwsdk_asset:/src/entry.js');
\`,
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("transforms link href attributes with preload rel", async () => {
    const code = `
      jsx("link", {
        rel: "preload",
        href: "/src/client.tsx",
        as: "script"
      })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `
      jsx("link", {
        rel: "preload",
        href: "rwsdk_asset:/src/client.tsx",
        as: "script"
      })
    `;
    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
    expect(clientEntryPoints.size).toBe(0); // Make sure it doesn't incorrectly add to entry points
  });

  it("transforms link href attributes with modulepreload rel", async () => {
    const code = `
      jsx("link", {
        href: "/src/client.tsx",
        rel: "modulepreload"
      })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `
      jsx("link", {
        href: "rwsdk_asset:/src/client.tsx",
        rel: "modulepreload"
      })
    `;
    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
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
              jsx("link", { rel: "modulepreload", href: "rwsdk_asset:/src/client.tsx", as: "script" })
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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

jsx("html", {
lang: "en",
children: [
jsx("head", {
children: [
jsx("meta", { charSet: "utf-8" }),
jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
jsx("title", { children: "@redwoodjs/starter-standard" }),
jsx("link", { rel: "modulepreload", href: "rwsdk_asset:/src/client.tsx", as: "script" })
]
}),
jsx("body", {
children: [
jsx("div", { id: "root", children: props.children }),
(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
jsx("script", { children: "import(\\"rwsdk_asset:/src/client.tsx\\")",
nonce: requestInfo.rw.nonce
})
)
]
})
]
})`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("returns null when no transformations are needed", async () => {
    const code = `
      jsx("div", { children: "No scripts or links here" })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    expect(result).toBeUndefined();
  });

  it("handles paths not found in manifest", async () => {
    const code = `
      jsx("script", {
        src: "/src/non-existent.js",
        type: "module"
      })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/non-existent.js")),
jsx("script", {
src: "rwsdk_asset:/src/non-existent.js",
type: "module",
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("adds nonce to script tags with src attribute and imports requestInfo", async () => {
    const code = `
      jsx("script", {
        src: "/src/client.tsx",
        type: "module"
      })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
jsx("script", {
src: "rwsdk_asset:/src/client.tsx",
type: "module",
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("adds nonce to script tags with string literal children", async () => {
    const code = `
      jsx("script", {
        type: "module",
        children: "console.log('hello world')"
      })
    `;

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

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

    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

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
    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    const expected = `import { requestInfo } from "rwsdk/worker";

(
(requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
jsx("script", {
src: "rwsdk_asset:/src/client.tsx",
type: "module",
nonce: requestInfo.rw.nonce
})
)`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });

  it("regression favicon links", async () => {
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
    /* @__PURE__ */ jsxDEV("link", { rel: "modulepreload", href: "rwsdk_asset:/src/client.tsx" }, void 0, false, {
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
    const clientEntryPoints = new Set<string>();
    const result = await transformJsxScriptTagsCode(
      code,
      clientEntryPoints,
      mockManifest,
      "/project/root/dir",
    );

    // For this complex test, we'll just verify the key transformations
    const expected = `
import { jsxDEV } from "react/jsx-dev-runtime";
import styles from "./index.css?url";
import { requestInfo } from "rwsdk/worker";

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
/* @__PURE__ */ jsxDEV("script", { src: "rwsdk_asset:/theme-script.js",
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
  /* @__PURE__ */ jsxDEV("link", { rel: "modulepreload", href: "rwsdk_asset:/src/client.tsx" }, void 0, false, {
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
/* @__PURE__ */ jsxDEV("script", { children: "import(\\"rwsdk_asset:/src/client.tsx\\")",
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
}, this);`;

    expect(normalizeCode(result?.code || "")).toEqual(normalizeCode(expected));
  });
});
