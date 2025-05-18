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
      "import { createServerReference } from "rwsdk/client";
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
      "import { createServerReference } from "rwsdk/client";

      // Comment

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
      "import { createServerReference } from "rwsdk/client";

      // Multi-line
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
      import { createServerReference } from "rwsdk/client";
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
        "worker",
      ),
    ).toMatchInlineSnapshot(`
      "import { registerServerReference } from "rwsdk/worker";

        export function execute() {
          return 1 + 1;
        }
      registerServerReference(execute, "/test.tsx", "execute");

      export default execute;
                    "
    `);
  });

  it.only("supports default exports", () => {
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
    ).toBeTruthy();
  });
});
