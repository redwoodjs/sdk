import { describe, it, expect } from "vitest";
import { transformUseClientCode } from "./useClientPlugin.mjs";

describe("transformUseClientCode", () => {
  async function transform(code: string) {
    const result = await transformUseClientCode(code, "/test/file.tsx", true);
    return result.code;
  }

  it("transforms arrow function component", async () => {
    expect(
      await transform(`"use client"

export const Component = () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const ComponentSSR = () => {
        return jsx('div', { children: 'Hello' });
      }
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);
      export { ComponentSSR, Component };"
    `);
  });

  it("does nothing for irrelevant exports", async () => {
    expect(
      await transform(`"use client"

export const foo = "bar"
export const baz = 23
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      export const foo = "bar"
      export const baz = 23
      }"
    `);
  });

  it("transforms async arrow function component", async () => {
    expect(
      await transform(`"use client"

export const Component = async () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const ComponentSSR = async () => {
        return jsx('div', { children: 'Hello' });
      }
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);
      export { ComponentSSR, Component };"
    `);
  });

  it("transforms function declaration component", async () => {
    expect(
      await transform(`"use client"

export function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      function ComponentSSR() {
        return jsx('div', { children: 'Hello' });
      }
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);
      export { ComponentSSR, Component };"
    `);
  });

  it("transforms async function declaration component", async () => {
    expect(
      await transform(`"use client"

export async function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      async function ComponentSSR() {
        return jsx('div', { children: 'Hello' });
      }
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);
      export { ComponentSSR, Component };"
    `);
  });

  it("transforms multiple arrow function components", async () => {
    expect(
      await transform(`"use client"

export const First = () => {
  return jsx('div', { children: 'First' });
}

export const Second = () => {
  return jsx('div', { children: 'Second' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = () => {
        return jsx('div', { children: 'Second' });
      }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms multiple async arrow function components", async () => {
    expect(
      await transform(`"use client"

export const First = async () => {
  return jsx('div', { children: 'First' });
}

export const Second = async () => {
  return jsx('div', { children: 'Second' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = async () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = async () => {
        return jsx('div', { children: 'Second' });
      }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms multiple function declaration components", async () => {
    expect(
      await transform(`"use client"

export function First() {
  return jsx('div', { children: 'First' });
}

export function Second() {
  return jsx('div', { children: 'Second' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms multiple async function declaration components", async () => {
    expect(
      await transform(`"use client"

export async function First() {
  return jsx('div', { children: 'First' });
}

export async function Second() {
  return jsx('div', { children: 'Second' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      async function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      async function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms components with grouped exports (arrow functions)", async () => {
    expect(
      await transform(`"use client"

const First = () => {
  return jsx('div', { children: 'First' });
}

const Second = () => {
  return jsx('div', { children: 'Second' });
}

export { First, Second }`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = () => {
        return jsx('div', { children: 'Second' });
      }

      export { FirstSSR, SecondSSR }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms components with grouped exports (async arrow functions)", async () => {
    expect(
      await transform(`"use client"

const First = async () => {
  return jsx('div', { children: 'First' });
}

const Second = async () => {
  return jsx('div', { children: 'Second' });
}

export { First, Second }`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = async () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = async () => {
        return jsx('div', { children: 'Second' });
      }

      export { FirstSSR, SecondSSR }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms components with grouped exports (function declarations)", async () => {
    expect(
      await transform(`"use client"

function First() {
  return jsx('div', { children: 'First' });
}

function Second() {
  return jsx('div', { children: 'Second' });
}

export { First, Second }`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }

      export { FirstSSR, SecondSSR }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms components with grouped exports (async function declarations)", async () => {
    expect(
      await transform(`"use client"

async function First() {
  return jsx('div', { children: 'First' });
}

async function Second() {
  return jsx('div', { children: 'Second' });
}

export { First, Second }`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      async function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      async function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }

      export { FirstSSR, SecondSSR }
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      export { FirstSSR, First };
      export { SecondSSR, Second };"
    `);
  });

  it("transforms default export arrow function component", async () => {
    expect(
      await transform(`"use client"

export default () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const DefaultComponent0SSR = () => {
        return jsx('div', { children: 'Hello' });
      }
      const DefaultComponent0 = registerClientReference("/test/file.tsx", "default", DefaultComponent0SSR);
      export { DefaultComponent0 as default, DefaultComponent0SSR };"
    `);
  });

  it("transforms default export async arrow function component", async () => {
    expect(
      await transform(`"use client"

export default async () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const DefaultComponent0SSR = async () => {
        return jsx('div', { children: 'Hello' });
      }
      const DefaultComponent0 = registerClientReference("/test/file.tsx", "default", DefaultComponent0SSR);
      export { DefaultComponent0 as default, DefaultComponent0SSR };"
    `);
  });

  it("transforms default export function declaration component", async () => {
    expect(
      await transform(`"use client"

export default function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      function ComponentSSR({ prop1, prop2 }) {
        return jsx('div', { children: 'Hello' });
      }
      const Component = registerClientReference("/test/file.tsx", "default", ComponentSSR);
      export { Component as default, ComponentSSR };"
    `);
  });

  it("transforms default export async function declaration component", async () => {
    expect(
      await transform(`"use client"

export default async function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      async function ComponentSSR() {
        return jsx('div', { children: 'Hello' });
      }
      const Component = registerClientReference("/test/file.tsx", "default", ComponentSSR);
      export { Component as default, ComponentSSR };"
    `);
  });

  it("transforms complex component with multiple computations", async () => {
    expect(
      await transform(`"use client"

export function ComplexComponent({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState([]);
  const doubledCount = useMemo(() => count * 2, [count]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAddItem = useCallback(() => {
    const newItem = {
      id: Math.random().toString(36),
      value: Math.floor(Math.random() * 100)
    };
    setItems(prev => [...prev, newItem]);
  }, []);

  const filteredItems = items.filter(item => item.value > 50);
  const total = filteredItems.reduce((sum, item) => sum + item.value, 0);

  if (items.length === 0) {
    return jsx('div', { children: 'No items yet' });
  }

  return jsxs('div', {
    className: 'complex-component',
    children: [
      jsxs('div', {
        className: 'counter-section',
        children: [
          jsx('h2', { children: 'Counter' }),
          jsxs('p', { 
            children: [
              'Count: ',
              jsx('span', { children: count }),
              ' (Doubled: ',
              jsx('span', { children: doubledCount }),
              ')'
            ]
          })
        ]
      }),
      jsxs('div', {
        className: 'items-section',
        children: [
          jsx('h2', { children: 'Items' }),
          jsx('button', {
            onClick: handleAddItem,
            children: 'Add Random Item'
          }),
          jsxs('div', {
            children: [
              'Total value of filtered items: ',
              jsx('span', { children: total })
            ]
          }),
          jsx('ul', {
            children: filteredItems.map(item => 
              jsx('li', {
                key: item.id,
                children: \`Item \${item.id}: \${item.value}\`
              })
            )
          })
        ]
      })
    ]
  });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      function ComplexComponentSSR({ initialCount = 0 }) {
        const [count, setCount] = useState(initialCount);
        const [items, setItems] = useState([]);
        const doubledCount = useMemo(() => count * 2, [count]);
        
        useEffect(() => {
          const timer = setInterval(() => {
            setCount(c => c + 1);
          }, 1000);
          return () => clearInterval(timer);
        }, []);

        const handleAddItem = useCallback(() => {
          const newItem = {
            id: Math.random().toString(36),
            value: Math.floor(Math.random() * 100)
          };
          setItems(prev => [...prev, newItem]);
        }, []);

        const filteredItems = items.filter(item => item.value > 50);
        const total = filteredItems.reduce((sum, item) => sum + item.value, 0);

        if (items.length === 0) {
          return jsx('div', { children: 'No items yet' });
        }

        return jsxs('div', {
          className: 'complex-component',
          children: [
            jsxs('div', {
              className: 'counter-section',
              children: [
                jsx('h2', { children: 'Counter' }),
                jsxs('p', { 
                  children: [
                    'Count: ',
                    jsx('span', { children: count }),
                    ' (Doubled: ',
                    jsx('span', { children: doubledCount }),
                    ')'
                  ]
                })
              ]
            }),
            jsxs('div', {
              className: 'items-section',
              children: [
                jsx('h2', { children: 'Items' }),
                jsx('button', {
                  onClick: handleAddItem,
                  children: 'Add Random Item'
                }),
                jsxs('div', {
                  children: [
                    'Total value of filtered items: ',
                    jsx('span', { children: total })
                  ]
                }),
                jsx('ul', {
                  children: filteredItems.map(item => 
                    jsx('li', {
                      key: item.id,
                      children: \`Item \${item.id}: \${item.value}\`
                    })
                  )
                })
              ]
            })
          ]
        });
      }
      const ComplexComponent = registerClientReference("/test/file.tsx", "ComplexComponent", ComplexComponentSSR);
      export { ComplexComponentSSR, ComplexComponent };"
    `);
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
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = () => {
        return jsx('div', { children: 'Second' });
      }

      function ThirdSSR() {
        return jsx('div', { children: 'Third' });
      }

      const FourthSSR = () => {
        return jsx('div', { children: 'Fourth' });
      }

      function MainSSR() {
        return jsx('div', { children: 'Main' });
      }

      export { SecondSSR, ThirdSSR }
      export { FourthSSR as AnotherName }
      const Third = registerClientReference("/test/file.tsx", "Third", ThirdSSR);
      const Main = registerClientReference("/test/file.tsx", "default", MainSSR);
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      const Fourth = registerClientReference("/test/file.tsx", "Fourth", FourthSSR);
      export { ThirdSSR, Third };
      export { Main as default, MainSSR };
      export { FirstSSR, First };
      export { SecondSSR, Second };
      export { FourthSSR, Fourth };"
    `);
  });

  it("transforms function declaration that is exported default separately", async () => {
    expect(
      await transform(`
"use client"

function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}

export default Component;`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "@redwoodjs/sdk/worker";

      function ComponentSSR({ prop1, prop2 }) {
        return jsx('div', { children: 'Hello' });
      }

      const Component = registerClientReference("/test/file.tsx", "default", ComponentSSR);
      export { Component as default, ComponentSSR };"
    `);
  });

  it("Works in dev", async () => {
    expect(
      await transform(`"use client"
import { jsxDEV } from "react/jsx-dev-runtime";
import { sendMessage } from "./functions";
import { useState } from "react";
import { consumeEventStream } from "@redwoodjs/sdk/client";

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
    ).toMatchInlineSnapshot(`
      "import { jsxDEV } from "react/jsx-dev-runtime";
      import { sendMessage } from "./functions";
      import { useState } from "react";
      import { consumeEventStream } from "@redwoodjs/sdk/client";
      import { registerClientReference } from "@redwoodjs/sdk/worker";

      function ChatSSR() {
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
      const Chat = registerClientReference("/test/file.tsx", "Chat", ChatSSR);
      export { ChatSSR, Chat };
      "
    `);
  });
});
