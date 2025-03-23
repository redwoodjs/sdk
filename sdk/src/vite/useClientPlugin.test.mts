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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export const ComponentSSR = () => {
        return jsx('div', { children: 'Hello' });
      }

      // >>> Client references
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);

      export { Component };
      "
    `);
  });

  it("transforms async arrow function component", async () => {
    expect(
      await transform(`"use client"

export const Component = async () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export const ComponentSSR = async () => {
        return jsx('div', { children: 'Hello' });
      }

      // >>> Client references
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);

      export { Component };
      "
    `);
  });

  it("transforms function declaration component", async () => {
    expect(
      await transform(`"use client"

export function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export function ComponentSSR() {
        return jsx('div', { children: 'Hello' });
      }

      // >>> Client references
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);

      export { Component };
      "
    `);
  });

  it("transforms async function declaration component", async () => {
    expect(
      await transform(`"use client"

export async function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export async function ComponentSSR() {
        return jsx('div', { children: 'Hello' });
      }

      // >>> Client references
      const Component = registerClientReference("/test/file.tsx", "Component", ComponentSSR);

      export { Component };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export const FirstSSR = () => {
        return jsx('div', { children: 'First' });
      }

      export const SecondSSR = () => {
        return jsx('div', { children: 'Second' });
      }

      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export const FirstSSR = async () => {
        return jsx('div', { children: 'First' });
      }

      export const SecondSSR = async () => {
        return jsx('div', { children: 'Second' });
      }

      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      export function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }

      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export async function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      export async function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }

      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = () => {
        return jsx('div', { children: 'Second' });
      }



      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { FirstSSR, SecondSSR };

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      const FirstSSR = async () => {
        return jsx('div', { children: 'First' });
      }

      const SecondSSR = async () => {
        return jsx('div', { children: 'Second' });
      }



      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { FirstSSR, SecondSSR };

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }



      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { FirstSSR, SecondSSR };

      export { First, Second };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      async function FirstSSR() {
        return jsx('div', { children: 'First' });
      }

      async function SecondSSR() {
        return jsx('div', { children: 'Second' });
      }



      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);

      export { FirstSSR, SecondSSR };

      export { First, Second };
      "
    `);
  });

  it("transforms default export arrow function component", async () => {
    expect(
      await transform(`"use client"

export default () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      function AnonymousComponent0SSR()  {
        return jsx('div', { children: 'Hello' })

      // >>> Client references
      const AnonymousComponent0 = registerClientReference("/test/file.tsx", "AnonymousComponent0", AnonymousComponent0SSR);

      export { AnonymousComponent0SSR };
      export { AnonymousComponent0 as default };;
      }"
    `);
  });

  it("transforms default export async arrow function component", async () => {
    expect(
      await transform(`"use client"

export default async () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      async function AnonymousComponent0SSR()  {
        return jsx('div', { children: 'Hello' })

      // >>> Client references
      const AnonymousComponent0 = registerClientReference("/test/file.tsx", "AnonymousComponent0", AnonymousComponent0SSR);

      export { AnonymousComponent0SSR };
      export { AnonymousComponent0 as default };;
      }"
    `);
  });

  it("transforms default export function declaration component", async () => {
    expect(
      await transform(`"use client"

export default function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      function ComponentSSR{
        return jsx('div', { children: 'Hello' });
      }

      // >>> Client references
      const Component = registerClientReference("/test/file.tsx", "default", ComponentSSR);

      export { ComponentSSR };
      export { Component as default };
      "
    `);
  });

  it("transforms default export async function declaration component", async () => {
    expect(
      await transform(`"use client"

export default async function Component() {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      async function ComponentSSR{
        return jsx('div', { children: 'Hello' });
      }

      // >>> Client references
      const Component = registerClientReference("/test/file.tsx", "default", ComponentSSR);

      export { ComponentSSR };
      export { Component as default };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export function ComplexComponentSSR({ initialCount = 0 }) {
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

      // >>> Client references
      const ComplexComponent = registerClientReference("/test/file.tsx", "ComplexComponent", ComplexComponentSSR);

      export { ComplexComponent };
      "
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
      "
      import { registerClientReference } from "@redwoodjs/sdk/worker";
      export const FirstSSR = () => {
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

      function MainSSR{
        return jsx('div', { children: 'Main' });
      }




      // >>> Client references
      const First = registerClientReference("/test/file.tsx", "First", FirstSSR);
      const Main = registerClientReference("/test/file.tsx", "default", MainSSR);
      const Second = registerClientReference("/test/file.tsx", "Second", SecondSSR);
      const Third = registerClientReference("/test/file.tsx", "Third", ThirdSSR);
      const Fourth = registerClientReference("/test/file.tsx", "AnotherName", FourthSSR);

      export { MainSSR, SecondSSR, ThirdSSR, FourthSSR };

      export { First, Second, Third, Fourth as AnotherName };
      export { Main as default };
      "
    `);
  });
});
