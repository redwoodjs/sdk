import { describe, expect, it } from "vitest";
import { transformServerFunctions } from "./transformServerFunctions.mjs";

describe("useServerPlugin", () => {
  let COMMENT_CODE = `
// Comment
"use server";

export function sum() {
  return 1 + 1;
}
`;

  let MULTI_LINE_COMMENT_CODE = `
// Multi-line
// Comment
"use server";

export function sum() {
  return 1 + 1
}
`;

  let COMMENT_BLOCK_CODE = `
/* Giant
 * Comment
 * Block
 */
"use server";

export function sum() {
  return 1 + 1
}
`;

  let DEFAULT_EXPORT_CODE = `
"use server";

export default function sum() {
  return 1 + 1;
}
`;

  let DEFAULT_AND_NAMED_EXPORTS_CODE = `
"use server";

export function sum() {
  return 1 + 1;
}

export default function sum() {
  return 1 + 2;
}
`;

  let NAMED_EXPORT_CODE = `
"use server";

export function sum() {
  return 1 + 1
}
`;

  let ARROW_FUNCTION_EXPORT_CODE = `
"use server";

export const sum = () => {
  return 1 + 1
}
`;

  let ASYNC_FUNCTION_EXPORT_CODE = `
"use server";

export async function sum() {
  return 1 + 1
}
`;

  let IGNORE_NON_FUNCTION_EXPORT_CODE = `
"use server";

export const a = "string";
`;

  let RE_EXPORT_CODE = `
"use server";

export { sum } from './math';
export { default as multiply } from './multiply';
export * from './utils';
`;

  const TEST_CASES = {
    COMMENT_CODE,
    MULTI_LINE_COMMENT_CODE,
    COMMENT_BLOCK_CODE,
    DEFAULT_EXPORT_CODE,
    NAMED_EXPORT_CODE,
    ARROW_FUNCTION_EXPORT_CODE,
    ASYNC_FUNCTION_EXPORT_CODE,
    IGNORE_NON_FUNCTION_EXPORT_CODE,
    DEFAULT_AND_NAMED_EXPORTS_CODE,
    RE_EXPORT_CODE,
  };

  describe("TRANSFORMS", () => {
    for (const [key, CODE] of Object.entries(TEST_CASES)) {
      describe(key, () => {
        it(`CLIENT`, () => {
          const result = transformServerFunctions(CODE, "/test.tsx", "client");
          expect(result?.code).toMatchSnapshot();
        });

        it(`WORKER`, () => {
          const result = transformServerFunctions(CODE, "/test.tsx", "worker");
          expect(result?.code).toMatchSnapshot();
        });

        it(`SSR`, () => {
          const result = transformServerFunctions(CODE, "/test.tsx", "ssr");
          expect(result?.code).toMatchSnapshot();
        });
      });
    }
  });
});
