import { describe, it, expect } from "vitest";
import { hasDirective } from "./hasDirective.mjs";

describe("hasDirective", () => {
  it('should find "use client" directive with double quotes', () => {
    const code = `"use client";
    import React from "react";
    const MyComponent = () => <div>Hello</div>;
    export default MyComponent;`;
    expect(hasDirective(code)).toBe("use client");
  });

  it("should find 'use server' directive with single quotes", () => {
    const code = `'use server';
    export async function myAction() {}`;
    expect(hasDirective(code)).toBe("use server");
  });

  it("should find directive with leading whitespace", () => {
    const code = `    "use client";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBe("use client");
  });

  it("should find directive after single-line comments", () => {
    const code = `// This is a component
    "use client";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBe("use client");
  });

  it("should find directive after multi-line comments", () => {
    const code = `/* This is a component */
    "use client";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBe("use client");
  });

  it("should find directive after empty lines", () => {
    const code = `

    "use client";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBe("use client");
  });

  it('should find "use client" directive when preceded by "use strict"', () => {
    const code = `
      "use strict";
      "use client";
      import React from 'react';
      export default () => <div>Hello</div>;
    `;
    expect(hasDirective(code)).toBe("use client");
  });

  it('should find "use server" directive when preceded by "use strict" and comments', () => {
    const code = `
      // server stuff
      "use strict";
      /* another comment */
      "use server";
      export async function myAction() {}
    `;
    expect(hasDirective(code)).toBe("use server");
  });

  it("should find directive when preceded by another string literal directive", () => {
    const code = `
      "use awesome"; // Some other directive
      "use client";
      import React from 'react';
      export default () => <div>Hello</div>;
    `;
    expect(hasDirective(code)).toBe("use client");
  });

  it("should return null if no directive is present", () => {
    const code = `import React from "react";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBeNull();
  });

  it("should return null if directive is not at the top", () => {
    const code = `import React from "react";
    "use client";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBeNull();
  });

  it("should return null if directive is inside a single-line comment", () => {
    const code = `// "use client";
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBeNull();
  });

  it("should return null if directive is inside a multi-line comment", () => {
    const code = `/*
     * "use client";
     */
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code)).toBeNull();
  });

  it("should return null if directive is a substring in other code", () => {
    const code = `const message = 'please "use client" wisely';`;
    expect(hasDirective(code)).toBeNull();
  });

  it("should handle a file with only the directive", () => {
    const code = `"use client"`;
    expect(hasDirective(code)).toBe("use client");
  });

  it("should handle mixed comments, whitespace, and the directive", () => {
    const code = `// A component

    /*
      Another comment
    */

    'use client';

    const MyComponent = () => <div>Hello</div>;
    `;
    expect(hasDirective(code)).toBe("use client");
  });
});
