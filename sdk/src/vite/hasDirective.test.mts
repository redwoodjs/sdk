import { describe, expect, it } from "vitest";
import { hasDirective } from "./hasDirective.mjs";

describe("hasDirective", () => {
  it('should find "use client" directive', () => {
    const code = `"use client"; import React from "react";`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it('should find "use server" directive', () => {
    const code = `'use server'; export async function myAction() {}`;
    expect(hasDirective(code, "use server")).toBe(true);
  });

  it("should not find a directive that is not there", () => {
    const code = `import React from "react";`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it('should find "use client" directive with single quotes', () => {
    const code = `'use client'; import React from "react";`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should find directive when preceded by comments and whitespace", () => {
    const code = `
      // This is a client component
      /* And here is another comment */

      "use client";
      import React from 'react';
      export default () => <div>Hello</div>;
    `;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it('should find "use client" directive when preceded by "use strict"', () => {
    const code = `
      "use strict";
      "use client";
      import React from 'react';
      export default () => <div>Hello</div>;
    `;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it('should find "use server" directive when preceded by "use strict" and comments', () => {
    const code = `
      // server stuff
      "use strict";
      /* another comment */
      "use server";
      export async function myAction() {}
    `;
    expect(hasDirective(code, "use server")).toBe(true);
  });

  it("should find directive when preceded by another string literal directive", () => {
    const code = `
      "use awesome"; // Some other directive
      "use client";
      import React from 'react';
      export default () => <div>Hello</div>;
    `;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should return false if no directive is present", () => {
    const code = `import React from "react";
    export default () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false if the directive is commented out", () => {
    const code = `// "use client";
    import React from "react";
    export default () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should return false if the directive appears after code", () => {
    const code = `import React from "react";
    "use client";
    export default () => <div>Hello</div>;`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should handle multi-line comments correctly", () => {
    const code = `
      /*
       * "use client";
       */
      import React from "react";
    `;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should handle code with no whitespace", () => {
    const code = `"use client";import React from "react";`;
    expect(hasDirective(code, "use client")).toBe(true);
  });

  it("should handle empty code", () => {
    const code = "";
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should handle code with only whitespace", () => {
    const code = "  \n\t  ";
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should handle files with only comments", () => {
    const code = `// comment 1
    /* comment 2 */`;
    expect(hasDirective(code, "use client")).toBe(false);
  });

  it("should prioritize 'use client' over 'use server'", () => {
    const code = `'use client';\n'use server';\nconsole.log('hello');`;
    expect(hasDirective(code, "use client")).toBe(true);
    expect(hasDirective(code, "use server")).toBe(false);
  });
});
