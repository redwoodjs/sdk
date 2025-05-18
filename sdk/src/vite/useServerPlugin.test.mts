import { describe, expect, it } from "vitest";
import { transformServerFunctions } from "./useServerPlugin.mjs";

describe("useServerPlugin", () => {
  it("determines react server directive", () => {
    expect(
      transformServerFunctions(
        `\
"use server";
            `,
        "/test.tsx",
        "client",
      ),
    ).toMatchInlineSnapshot(`
      "
                  "
    `);

    expect(
      transformServerFunctions(
        `\
// These are not server functions
            `,
        "/test.tsx",
        "client",
      ),
    ).toMatchInlineSnapshot(`undefined`);

    expect(
      transformServerFunctions(
        `\
// Comment
"use server";
              `,
        "/test.tsx",
        "client",
      ),
    ).toMatchInlineSnapshot(`
      "// Comment

                    "
    `);

    expect(
      transformServerFunctions(
        `\
// Multi-line
// Comment
"use server";
                `,
        "/test.tsx",
        "client",
      ),
    ).toMatchInlineSnapshot(`
      "// Multi-line
      // Comment

                      "
    `);

    expect(
      transformServerFunctions(
        `\
/* Giant
 * Comment
 * Block
 */

"use server";
                  `,
        "/test.tsx",
        "client",
      ),
    ).toMatchInlineSnapshot(`
      "/* Giant
       * Comment
       * Block
       */


                        "
    `);
  });

  it("supports default exports", () => {
    expect(
      transformServerFunctions(
        `\
  "use server";

  export default function execute() {
    return 1 + 1;
  }
              `,
        "/test.tsx",
        "client",
      ),
    ).toMatchInlineSnapshot(`
      "  

        export function execute() {
          return 1 + 1;
        }

      export default execute;
                    "
    `);
  });
});
