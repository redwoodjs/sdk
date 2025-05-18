import { describe, expect, it } from "vitest";
import { transformServerFunctions } from "./useServerPlugin.mjs";

describe("useServerPlugin", () => {
  it("determines react server directive", () => {
    expect(
      transformServerFunctions(`\
"use server";
            `),
    ).toMatchInlineSnapshot(`
      "
                  "
    `);

    expect(
      transformServerFunctions(`\
// These are not server functions
            `),
    ).toMatchInlineSnapshot(`undefined`);

    expect(
      transformServerFunctions(`\
// Comment
"use server";
              `),
    ).toMatchInlineSnapshot(`
      "// Comment

                    "
    `);

    expect(
      transformServerFunctions(`\
// Multi-line
// Comment
"use server";
                `),
    ).toMatchInlineSnapshot(`
      "// Multi-line
      // Comment

                      "
    `);

    expect(
      transformServerFunctions(`\
/* Giant
 * Comment
 * Block
 */

"use server";
                  `),
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
      transformServerFunctions(`\
  "use server";

  export default function execute() {
    return 1 + 1;
  }
              `),
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
