import { describe, it, expect } from "vitest";
import { hasDirective } from "./hasDirective.mjs";

describe("hasDirective", () => {
  it('should find "use client" directive with double quotes', () => {
    const code = `"use client";
    
    import React from "react";
    
    const MyComponent = () => <div>Hello</div>;
    export default MyComponent;`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should find 'use server' directive with single quotes", () => {
    const code = `'use server';
    
    export async function myAction() {
      // ...
    }`;
    expect(hasDirective(code, "use server")).toBe(true);
  });

  it("should find directive with leading whitespace", () => {
    const code = `    "use client";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should find directive after single-line comments", () => {
    const code = `// This is a component
    "use client";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should find directive after multi-line comments", () => {
    const code = `/* This is a component */
    "use client";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should find directive after empty lines", () => {
    const code = `

    "use client";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should return false if no directive is present", () => {
    const code = `import React from "react";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false if directive is not at the top", () => {
    const code = `import React from "react";
    "use client";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false if directive is inside a single-line comment", () => {
    const code = `// "use client";
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false if directive is inside a multi-line comment", () => {
    const code = `/*
     * "use client";
     */
    
    const MyComponent = () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false if directive is a substring in other code", () => {
    const code = `const message = 'please "use client" wisely';`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should handle a file with only the directive", () => {
    const code = `"use client"`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should handle mixed comments, whitespace, and the directive", () => {
    const code = `// A component
    
    /* 
      Another comment
    */
   
    'use client';

    const MyComponent = () => <div>Hello</div>;
    `;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should handle multi-line comment ending on same line", () => {
    const code = `/* "use client" */
    const MyComponent = () => <div>Hello</div>;
    `;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false for code where directive appears after a valid line of code", () => {
    const code = `const a = 1;
    "use client";
    `;
    expect(hasDirective(code, "use client")).toBe(false);
  });
});
