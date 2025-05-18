import { describe, expect, it } from "vitest";
import { includesReactServerDirective } from "./useServerPlugin.mjs";

describe("useServerPlugin", () => {
  it("determines react server directive", () => {
    expect(
      includesReactServerDirective(`\
"use server";
            `),
    ).toEqual(true);

    expect(
      includesReactServerDirective(`\
// These are not server functions
            `),
    ).toEqual(false);

    expect(
      includesReactServerDirective(`\
// Comment
"use server";
              `),
    ).toEqual(true);

    expect(
      includesReactServerDirective(`\
// Multi-line
// Comment
"use server";
                `),
    ).toEqual(true);

    expect(
      includesReactServerDirective(`\
/* Giant
 * Comment
 * Block
 */

"use server";
                  `),
    ).toEqual(true);
  });
});
