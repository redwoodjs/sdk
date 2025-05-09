import { describe, it, expect } from "vitest";
import { transformUseClientCode } from "./useClientPlugin.mjs";

describe("transformUseClientCode", () => {
  async function transform(code: string) {
    const result = await transformUseClientCode(code, "/test/file.tsx");
    return result?.code;
  }

  it("transforms arrow function component", async () => {
    expect(
      await transform(`"use client"

export const Component = () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";
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

  it("transforms complex grouped export cases", async () => {
    expect(
      await transform(`
"use client";

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { jsx, jsxs } from "react/jsx-runtime"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return jsx(
    Comp,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  )
}

export { Button, buttonVariants }
`),
    ).toMatchInlineSnapshot(`
      "
      import * as React from "react"
      import { Slot } from "@radix-ui/react-slot"
      import { cva, type VariantProps } from "class-variance-authority"
      import { jsx, jsxs } from "react/jsx-runtime"

      import { cn } from "@/lib/utils"
      import { registerClientReference } from "rwsdk/worker";

      const buttonVariants = cva(
        "font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        {
          variants: {
            variant: {
              default:
                "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
              destructive:
                "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
              outline:
                "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
              secondary:
                "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
              ghost:
                "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
              link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
              default: "h-9 px-4 py-2 has-[>svg]:px-3",
              sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
              lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
              icon: "size-9",
            },
          },
          defaultVariants: {
            variant: "default",
            size: "default",
          },
        }
      )

      function ButtonSSR({
        className,
        variant,
        size,
        asChild = false,
        ...props
      }: React.ComponentProps<"button"> &
        VariantProps<typeof buttonVariants> & {
          asChild?: boolean
        }) {
        const Comp = asChild ? Slot : "button"

        return jsx(
          Comp,
          {
            "data-slot": "button",
            className: cn(buttonVariants({ variant, size, className })),
            ...props
          }
        )
      }

      export { buttonVariants };
      const Button = registerClientReference("/test/file.tsx", "Button", ButtonSSR);
      export { ButtonSSR, Button };
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
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";

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

  it("transforms default export arrow function component", async () => {
    expect(
      await transform(`"use client"

export default () => {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";
      const DefaultComponent0SSR = async () => {
        return jsx('div', { children: 'Hello' });
      }
      const DefaultComponent0 = registerClientReference("/test/file.tsx", "default", DefaultComponent0SSR);
      export { DefaultComponent0 as default, DefaultComponent0SSR };"
    `);
  });

  it("transforms complex default export cases", async () => {
    expect(
      await transform(`
"use client";
import { jsxDEV } from "react/jsx-dev-runtime";
import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, CheckIcon } from "./icons";
export const MovieSelector = ({
  label,
  selectedMovie,
  onSelect,
  otherSelectedMovie,
  movies,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const selectedMovieObj = movies.find((movie) => movie.id === selectedMovie);
  const availableMovies = movies.filter(
    (movie) => !otherSelectedMovie || movie.id !== otherSelectedMovie
  );
  return /* @__PURE__ */ jsxDEV("div", { className: "relative", ref: dropdownRef, children: [
    /* @__PURE__ */ jsxDEV("label", { className: "font-banner block text-sm font-medium text-gray-700 mb-1", children: label === "First Movie" ? "Mash ..." : "With ..." }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
      lineNumber: 49,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      "button",
      {
        type: "button",
        className: "w-full p-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed",
        onClick: () => setIsOpen(!isOpen),
        disabled: !!error,
        children: [
          error ? /* @__PURE__ */ jsxDEV("span", { className: "text-red-500", children: "Error loading movies" }, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 59,
            columnNumber: 11
          }, this) : selectedMovieObj ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center", children: [
            /* @__PURE__ */ jsxDEV(
              "img",
              {
                src: \`https://image.tmdb.org/t/p/w500/\${selectedMovieObj.photo}\`,
                alt: selectedMovieObj.title,
                className: "size-6 shrink-0 rounded-sm mr-2"
              },
              void 0,
              false,
              {
                fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                lineNumber: 62,
                columnNumber: 13
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("span", { children: selectedMovieObj.title }, void 0, false, {
              fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
              lineNumber: 67,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 61,
            columnNumber: 11
          }, this) : /* @__PURE__ */ jsxDEV("span", { className: "text-gray-500", children: label }, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 70,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV(ChevronDownIcon, { isOpen }, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 72,
            columnNumber: 9
          }, this)
        ]
      },
      void 0,
      true,
      {
        fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
        lineNumber: 52,
        columnNumber: 7
      },
      this
    ),
    isOpen && !error && /* @__PURE__ */ jsxDEV("div", { className: "absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm", children: availableMovies.map((movie) => /* @__PURE__ */ jsxDEV(
      "div",
      {
        className: "cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-purple-50",
        onClick: () => {
          onSelect(movie.id);
          setIsOpen(false);
        },
        children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center", children: [
            /* @__PURE__ */ jsxDEV(
              "img",
              {
                src: \`https://image.tmdb.org/t/p/w500/\${movie.photo}\`,
                alt: movie.title,
                className: "size-10 shrink-0 rounded-sm mr-2"
              },
              void 0,
              false,
              {
                fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                lineNumber: 87,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("span", { className: "block truncate text-base font-medium", children: movie.title }, void 0, false, {
              fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
              lineNumber: 92,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 86,
            columnNumber: 15
          }, this),
          selectedMovie === movie.id && /* @__PURE__ */ jsxDEV("span", { className: "absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600", children: /* @__PURE__ */ jsxDEV(CheckIcon, {}, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 99,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 98,
            columnNumber: 17
          }, this)
        ]
      },
      movie.id,
      true,
      {
        fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
        lineNumber: 78,
        columnNumber: 13
      },
      this
    )) }, void 0, false, {
      fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
      lineNumber: 76,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
    lineNumber: 48,
    columnNumber: 5
  }, this);
};

`),
    ).toMatchInlineSnapshot(`
      "
      import { jsxDEV } from "react/jsx-dev-runtime";
      import { useState, useEffect, useRef } from "react";
      import { ChevronDownIcon, CheckIcon } from "./icons";
      import { registerClientReference } from "rwsdk/worker";

      const MovieSelectorSSR = ({
        label,
        selectedMovie,
        onSelect,
        otherSelectedMovie,
        movies,
        error
      }) => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef(null);
        useEffect(() => {
          const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
              setIsOpen(false);
            }
          };
          document.addEventListener("mousedown", handleClickOutside);
          return () => {
            document.removeEventListener("mousedown", handleClickOutside);
          };
        }, []);
        const selectedMovieObj = movies.find((movie) => movie.id === selectedMovie);
        const availableMovies = movies.filter(
          (movie) => !otherSelectedMovie || movie.id !== otherSelectedMovie
        );
        return /* @__PURE__ */ jsxDEV("div", { className: "relative", ref: dropdownRef, children: [
          /* @__PURE__ */ jsxDEV("label", { className: "font-banner block text-sm font-medium text-gray-700 mb-1", children: label === "First Movie" ? "Mash ..." : "With ..." }, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 49,
            columnNumber: 7
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              type: "button",
              className: "w-full p-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed",
              onClick: () => setIsOpen(!isOpen),
              disabled: !!error,
              children: [
                error ? /* @__PURE__ */ jsxDEV("span", { className: "text-red-500", children: "Error loading movies" }, void 0, false, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 59,
                  columnNumber: 11
                }, this) : selectedMovieObj ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center", children: [
                  /* @__PURE__ */ jsxDEV(
                    "img",
                    {
                      src: \`https://image.tmdb.org/t/p/w500/\${selectedMovieObj.photo}\`,
                      alt: selectedMovieObj.title,
                      className: "size-6 shrink-0 rounded-sm mr-2"
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                      lineNumber: 62,
                      columnNumber: 13
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV("span", { children: selectedMovieObj.title }, void 0, false, {
                    fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                    lineNumber: 67,
                    columnNumber: 13
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 61,
                  columnNumber: 11
                }, this) : /* @__PURE__ */ jsxDEV("span", { className: "text-gray-500", children: label }, void 0, false, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 70,
                  columnNumber: 11
                }, this),
                /* @__PURE__ */ jsxDEV(ChevronDownIcon, { isOpen }, void 0, false, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 72,
                  columnNumber: 9
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
              lineNumber: 52,
              columnNumber: 7
            },
            this
          ),
          isOpen && !error && /* @__PURE__ */ jsxDEV("div", { className: "absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm", children: availableMovies.map((movie) => /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-purple-50",
              onClick: () => {
                onSelect(movie.id);
                setIsOpen(false);
              },
              children: [
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center", children: [
                  /* @__PURE__ */ jsxDEV(
                    "img",
                    {
                      src: \`https://image.tmdb.org/t/p/w500/\${movie.photo}\`,
                      alt: movie.title,
                      className: "size-10 shrink-0 rounded-sm mr-2"
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                      lineNumber: 87,
                      columnNumber: 17
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV("span", { className: "block truncate text-base font-medium", children: movie.title }, void 0, false, {
                    fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                    lineNumber: 92,
                    columnNumber: 17
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 86,
                  columnNumber: 15
                }, this),
                selectedMovie === movie.id && /* @__PURE__ */ jsxDEV("span", { className: "absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600", children: /* @__PURE__ */ jsxDEV(CheckIcon, {}, void 0, false, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 99,
                  columnNumber: 19
                }, this) }, void 0, false, {
                  fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
                  lineNumber: 98,
                  columnNumber: 17
                }, this)
              ]
            },
            movie.id,
            true,
            {
              fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
              lineNumber: 78,
              columnNumber: 13
            },
            this
          )) }, void 0, false, {
            fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
            lineNumber: 76,
            columnNumber: 9
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/justin/rw/blotter/ai-movie-mashup/src/app/pages/mashups/components/MovieSelector.tsx",
          lineNumber: 48,
          columnNumber: 5
        }, this);
      };
      const MovieSelector = registerClientReference("/test/file.tsx", "MovieSelector", MovieSelectorSSR);
      export { MovieSelectorSSR, MovieSelector };

      "
    `);
  });

  it("transforms default export function declaration component", async () => {
    expect(
      await transform(`"use client"

export default function Component({ prop1, prop2 }) {
  return jsx('div', { children: 'Hello' });
}`),
    ).toMatchInlineSnapshot(`
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";

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
      "import { registerClientReference } from "rwsdk/worker";
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
      "import { registerClientReference } from "rwsdk/worker";

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
    ).toMatchInlineSnapshot(`
      "import { jsxDEV } from "react/jsx-dev-runtime";
      import { sendMessage } from "./functions";
      import { useState } from "react";
      import { consumeEventStream } from "rwsdk/client";
      import { registerClientReference } from "rwsdk/worker";

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

  it("Does not transform when 'use client' is not directive", async () => {
    expect(
      await transform(`const message = "use client";`),
    ).toMatchInlineSnapshot(`undefined`);
  });
});
