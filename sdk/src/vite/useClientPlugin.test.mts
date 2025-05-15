import { describe, it, expect } from "vitest";
import { transformClientComponents } from "./useClientPlugin.mjs";

describe("transformClientComponents", () => {
  async function transform(code: string) {
    const result = await transformClientComponents(code, "/test/file.tsx");
    return result?.code;
  }

  it("transforms arrow function component", async () => {
    expect(
      await transform(`"use client"

export const Component = () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("does nothing for irrelevant exports", async () => {
    expect(
      await transform(`"use client"

export const foo = "bar"
export const baz = 23
}`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("transforms async arrow function component", async () => {
    expect(
      await transform(`"use client"

export const Component = async () => {
  return jsx('div', { children: 'Hello' });
}
  `),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("transforms function declaration component", async () => {
    expect(
      await transform(`"use client"

export function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("transforms default export arrow function component", async () => {
    expect(
      await transform(`"use client"

export default () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("transforms default export function declaration component", async () => {
    expect(
      await transform(`"use client"

export default function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("transforms mixed export styles (inline, grouped, and default)", async () => {
    expect(
      await transform(`"use client"

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
export { Fourth as AnotherName }`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("transforms function declaration that is exported default separately", async () => {
    expect(
      await transform(`
"use client"

function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}

export default Component;`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("Works in dev", async () => {
    expect(
      await transform(`"use client"
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
`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("Does not transform when 'use client' is not directive", async () => {
    expect(
      await transform(`const message = "use client";`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  // Additional tests for specific logic branches

  it("correctly handles 'use client' directive with semicolon", async () => {
    expect(
      await transform(`"use client";

export function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("properly handles export alias", async () => {
    expect(
      await transform(`"use client"

const MyComponent = () => {
  return jsx('div', { children: 'Hello' });
}

export { MyComponent as CustomName }`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("correctly processes multiple component exports", async () => {
    expect(
      await transform(`"use client"

const First = () => jsx('div', { children: 'First' });
const Second = () => jsx('div', { children: 'Second' });
const Third = () => jsx('div', { children: 'Third' });

export { First, Second, Third }`),
    ).toMatchInlineSnapshot(`undefined`);
  });

  it("handles combination of JSX and non-JSX exports", async () => {
    expect(
      await transform(`"use client"

const Component = () => jsx('div', {});
const data = { value: 42 };
const helper = () => console.log('helper');

export { Component, data, helper }`),
    ).toMatchInlineSnapshot(`undefined`);
  });
});
