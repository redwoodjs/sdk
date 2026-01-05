import { describe, expect, it } from "vitest";
import { transformClientComponents } from "./transformClientComponents.mjs";

describe("transformClientComponents", () => {
  async function transform(code: string) {
    const result = await transformClientComponents(code, "/test/file.tsx", {
      environmentName: "worker",
    });

    return result?.code;
  }

  it("transforms arrow function component", async () => {
    expect(
      (await transform(`"use client"

export const Component = () => {
  return jsx('div', { children: 'Hello' });
}
`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Component = registerClientReference(SSRModule, "/test/file.tsx", "Component");
export { Component };
`,
    );
  });

  it("transforms async arrow function component", async () => {
    expect(
      (await transform(`"use client"

export const Component = async () => {
  return jsx('div', { children: 'Hello' });
}
  `)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Component = registerClientReference(SSRModule, "/test/file.tsx", "Component");
export { Component };
`,
    );
  });

  it("transforms function declaration component", async () => {
    expect(
      (await transform(`"use client"

export function Component() {
  return jsx('div', { children: 'Hello' });
}`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Component = registerClientReference(SSRModule, "/test/file.tsx", "Component");
export { Component };
`,
    );
  });

  it("transforms default export arrow function component", async () => {
    expect(
      (await transform(`"use client"

export default () => {
  return jsx('div', { children: 'Hello' });
}`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
export default registerClientReference(SSRModule, "/test/file.tsx", "default");
`,
    );
  });

  it("transforms default export function declaration component", async () => {
    expect(
      (await transform(`"use client"

export default function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
export default registerClientReference(SSRModule, "/test/file.tsx", "default");
`,
    );
  });

  it("transforms mixed export styles (inline, grouped, and default)", async () => {
    expect(
      (await transform(`"use client"

export const First = () => {
  return jsx('div', { children: 'First' });
}

const Second = () => {
  return jsx('div', { children: 'Second' });
}

function Third() {
  return jsx('div', { children: 'Third' });
}

const Fourth = () => {
  return jsx('div', { children: 'Fourth' });
}

export default function Main() {
  return jsx('div', { children: 'Main' });
}

export { Second, Third }
export { Fourth as AnotherName }`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const First = registerClientReference(SSRModule, "/test/file.tsx", "First");
const Second = registerClientReference(SSRModule, "/test/file.tsx", "Second");
const Third = registerClientReference(SSRModule, "/test/file.tsx", "Third");
const Fourth_AnotherName = registerClientReference(SSRModule, "/test/file.tsx", "AnotherName");
export { First, Second, Third, Fourth_AnotherName as AnotherName };
export default registerClientReference(SSRModule, "/test/file.tsx", "default");
`,
    );
  });

  it("transforms function declaration that is exported default separately", async () => {
    expect(
      (await transform(`
"use client"

function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}

export default Component;`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
export default registerClientReference(SSRModule, "/test/file.tsx", "default");
`,
    );
  });

  it("Works in dev", async () => {
    expect(
      (await transform(`"use client"
import { jsxDEV } from "react/jsx-dev-runtime";
import { sendMessage } from "./functions";
import { useState } from "react";
import { consumeEventStream } from "rwsdk/client";

export function Chat() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const onClick = async () => {
    setReply("");
    (await sendMessage(message)).pipeTo(
      consumeEventStream({
        onChunk: (event) => {
          setReply(
            (prev) => prev + (event.data === "[DONE]" ? "" : JSON.parse(event.data).response)
          );
        }
      })
    );
  };
  return /* @__PURE__ */ jsxDEV("div", { children: [
    /* @__PURE__ */ jsxDEV(
      "input",
      {
        type: "text",
        value: message,
        placeholder: "Type a message...",
        onChange: (e) => setMessage(e.target.value),
        style: {
          width: "80%",
          padding: "10px",
          marginRight: "8px",
          borderRadius: "4px",
          border: "1px solid #ccc"
        }
      },
      void 0,
      false,
      {
        fileName: "/Users/justin/rw/sdk/experiments/ai-stream/src/app/pages/Chat/Chat.tsx",
        lineNumber: 28,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      "button",
      {
        onClick,
        style: {
          padding: "10px 20px",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "#007bff",
          color: "white",
          cursor: "pointer"
        },
        children: "Send"
      },
      void 0,
      false,
      {
        fileName: "/Users/justin/rw/sdk/experiments/ai-stream/src/app/pages/Chat/Chat.tsx",
        lineNumber: 41,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { children: reply }, void 0, false, {
      fileName: "/Users/justin/rw/sdk/experiments/ai-stream/src/app/pages/Chat/Chat.tsx",
      lineNumber: 54,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/justin/rw/sdk/experiments/ai-stream/src/app/pages/Chat/Chat.tsx",
    lineNumber: 27,
    columnNumber: 5
  }, this);
}
`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Chat = registerClientReference(SSRModule, "/test/file.tsx", "Chat");
export { Chat };
`,
    );
  });

  it("Does not transform when 'use client' is not directive", async () => {
    expect(await transform(`const message = "use client";`)).toEqual(undefined);
  });

  it("properly handles export alias", async () => {
    expect(
      (await transform(`"use client"

const MyComponent = () => {
  return jsx('div', { children: 'Hello' });
}

export { MyComponent as CustomName }`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const MyComponent_CustomName = registerClientReference(SSRModule, "/test/file.tsx", "CustomName");
export { MyComponent_CustomName as CustomName };
`,
    );
  });

  it("correctly processes multiple component exports", async () => {
    expect(
      (await transform(`"use client"

const First = () => jsx('div', { children: 'First' });
const Second = () => jsx('div', { children: 'Second' });
const Third = () => jsx('div', { children: 'Third' });

export { First, Second, Third }`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const First = registerClientReference(SSRModule, "/test/file.tsx", "First");
const Second = registerClientReference(SSRModule, "/test/file.tsx", "Second");
const Third = registerClientReference(SSRModule, "/test/file.tsx", "Third");
export { First, Second, Third };
`,
    );
  });

  it("handles combination of JSX and non-JSX exports", async () => {
    expect(
      (await transform(`"use client"

const Component = () => jsx('div', {});
const data = { value: 42 };
const helper = () => console.log('helper');

export { Component, data, helper }`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Component = registerClientReference(SSRModule, "/test/file.tsx", "Component");
const data = registerClientReference(SSRModule, "/test/file.tsx", "data");
const helper = registerClientReference(SSRModule, "/test/file.tsx", "helper");
export { Component, data, helper };
`,
    );
  });

  it("transforms multiple exports aliases for the same component", async () => {
    expect(
      (await transform(`"use client"

export const Slot = () => {
  return jsx('div', { children: 'Slot' });
}

export { Slot, Slot as Root }
`)) ?? "",
    ).toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Slot = registerClientReference(SSRModule, "/test/file.tsx", "Slot");
const Slot_Root = registerClientReference(SSRModule, "/test/file.tsx", "Root");
export { Slot, Slot_Root as Root };
`,
    );
  });

  it("handles a large number of named exports from a single module", async () => {
    const code = `"use client";
import * as React from "react";
const SidebarContext = React.createContext(null);
function SidebarProvider() { return jsx("div", {}); }
function useSidebar() {}
function Sidebar() { return jsx("div", {}); }
function SidebarTrigger() { return jsx("div", {}); }
function SidebarRail() { return jsx("div", {}); }
function SidebarInset() { return jsx("div", {}); }
function SidebarInput() { return jsx("div", {}); }
function SidebarHeader() { return jsx("div", {}); }
function SidebarFooter() { return jsx("div", {}); }
function SidebarSeparator() { return jsx("div", {}); }
function SidebarContent() { return jsx("div", {}); }
function SidebarGroup() { return jsx("div", {}); }
function SidebarGroupLabel() { return jsx("div", {}); }
function SidebarGroupAction() { return jsx("div", {}); }
function SidebarGroupContent() { return jsx("div", {}); }
function SidebarGroupContent() { return jsx("div", {}); }
function SidebarMenu() { return jsx("div", {}); }
function SidebarMenuItem() { return jsx("div", {}); }
function SidebarMenuButton() { return jsx("div", {}); }
function SidebarMenuAction() { return jsx("div", {}); }
function SidebarMenuBadge() { return jsx("div", {}); }
function SidebarMenuSkeleton() { return jsx("div", {}); }
function SidebarMenuSub() { return jsx("div", {}); }
function SidebarMenuSubItem() { return jsx("div", {}); }
function SidebarMenuSubButton() { return jsx("div", {}); }
export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar, };`;

    expect((await transform(code)) ?? "").toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Sidebar = registerClientReference(SSRModule, "/test/file.tsx", "Sidebar");
const SidebarContent = registerClientReference(SSRModule, "/test/file.tsx", "SidebarContent");
const SidebarFooter = registerClientReference(SSRModule, "/test/file.tsx", "SidebarFooter");
const SidebarGroup = registerClientReference(SSRModule, "/test/file.tsx", "SidebarGroup");
const SidebarGroupAction = registerClientReference(SSRModule, "/test/file.tsx", "SidebarGroupAction");
const SidebarGroupContent = registerClientReference(SSRModule, "/test/file.tsx", "SidebarGroupContent");
const SidebarGroupLabel = registerClientReference(SSRModule, "/test/file.tsx", "SidebarGroupLabel");
const SidebarHeader = registerClientReference(SSRModule, "/test/file.tsx", "SidebarHeader");
const SidebarInput = registerClientReference(SSRModule, "/test/file.tsx", "SidebarInput");
const SidebarInset = registerClientReference(SSRModule, "/test/file.tsx", "SidebarInset");
const SidebarMenu = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenu");
const SidebarMenuAction = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuAction");
const SidebarMenuBadge = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuBadge");
const SidebarMenuButton = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuButton");
const SidebarMenuItem = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuItem");
const SidebarMenuSkeleton = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuSkeleton");
const SidebarMenuSub = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuSub");
const SidebarMenuSubButton = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuSubButton");
const SidebarMenuSubItem = registerClientReference(SSRModule, "/test/file.tsx", "SidebarMenuSubItem");
const SidebarProvider = registerClientReference(SSRModule, "/test/file.tsx", "SidebarProvider");
const SidebarRail = registerClientReference(SSRModule, "/test/file.tsx", "SidebarRail");
const SidebarSeparator = registerClientReference(SSRModule, "/test/file.tsx", "SidebarSeparator");
const SidebarTrigger = registerClientReference(SSRModule, "/test/file.tsx", "SidebarTrigger");
const useSidebar = registerClientReference(SSRModule, "/test/file.tsx", "useSidebar");
export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar };
`,
    );
  });

  it("does not transform inlined functions (Issue #471)", async () => {
    const code = `"use client"

export function Stars({ level }) {
  const renderStars = (level) => {
    return level;
  }
  return renderStars(level);
}`;

    expect((await transform(code)) ?? "").toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
const Stars = registerClientReference(SSRModule, "/test/file.tsx", "Stars");
export { Stars };
`,
    );
  });

  it("does not transform inlined functions in default export (Issue #471)", async () => {
    const code = `"use client"

export default function Stars({ level }) {
  const renderStars = (level) => {
    return level;
  }
  return renderStars(level);
}`;

    expect((await transform(code)) ?? "").toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/file.tsx");
export default registerClientReference(SSRModule, "/test/file.tsx", "default");
`,
    );
  });
});

describe("transformClientComponents logic branches (from transformClientComponents.mts)", () => {
  it("returns code as-is if file does not start with 'use client'", async () => {
    const code = "const foo = 1;";
    const result = await transformClientComponents(code, "/test/file.tsx", {
      environmentName: "worker",
    });
    expect(result).toBeUndefined();
  });

  it("removes directive but does not transform if not a virtual SSR file", async () => {
    const code = '"use client"\nexport const foo = 1;';
    const result = await transformClientComponents(code, "/test/file.tsx", {
      environmentName: "ssr",
    });
    expect(result?.code).toEqual("export const foo = 1;");
  });
});

describe("transformClientComponents (dev server node_modules)", () => {
  async function transformDev(code: string, id: string) {
    process.env.VITE_IS_DEV_SERVER = "1";
    const result = await transformClientComponents(code, id, {
      environmentName: "worker",
    });
    delete (process.env as any).VITE_IS_DEV_SERVER;
    return result?.code;
  }

  it("uses barrel file import for node_modules files in dev", async () => {
    const id = "/test/node_modules/my-lib/component.js";
    const code = `"use client";
export const MyComponent = () => {};`;

    expect((await transformDev(code, id)) ?? "").toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/node_modules/my-lib/component.js");
const MyComponent = registerClientReference(SSRModule, "/test/node_modules/my-lib/component.js", "MyComponent");
export { MyComponent };
`,
    );
  });

  it("uses virtual module import for app source files in dev", async () => {
    const id = "/test/app/component.tsx";
    const code = `"use client";
export const MyComponent = () => {};`;

    expect((await transformDev(code, id)) ?? "").toEqual(
      `import { ssrLoadModule } from "rwsdk/__ssr_bridge";
import { registerClientReference } from "rwsdk/worker";
const SSRModule = await ssrLoadModule("/test/app/component.tsx");
const MyComponent = registerClientReference(SSRModule, "/test/app/component.tsx", "MyComponent");
export { MyComponent };
`,
    );
  });
});
