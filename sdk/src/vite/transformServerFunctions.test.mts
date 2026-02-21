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

  let PREDEFINED_DEFAULT_EXPORT_CODE = `
"use server";

const sum = () => {
  return 1 + 1;
}

export default sum;
`;

  let EXPORT_DEFAULT_FUNCTION_CODE = `
"use server";
export default function sum() {
  return 1 + 1;
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

  let RE_EXPORT_CODE = `
"use server";

export { sum } from './math';
export { default as multiply } from './multiply';
export * from './utils';
`;

  let SERVER_QUERY_GET_CODE = `
"use server";
export const getProject = serverQuery(async (id) => {
  return { id, name: "Project X" };
});
`;

  let SERVER_QUERY_POST_CODE = `
"use server";
export const getProject = serverQuery(async (id) => {
  return { id, name: "Project X" };
}, { method: "POST" });
`;

  let SERVER_ACTION_CODE = `
"use server";
export const upvote = serverAction(async (id) => {
  return { id, count: 1 };
});
`;

  let SERVER_QUERY_DEFAULT_CODE = `
"use server";
export default serverQuery(async (id) => {
  return { id, name: "Project X" };
});
`;

  let SERVER_ACTION_DEFAULT_CODE = `
"use server";
export default serverAction(async (id) => {
  return { id, name: "Project X" };
});
`;

  let SERVER_QUERY_ARRAY_CODE = `
"use server";
export const getProject = serverQuery([
  auth,
  async (id) => {
    return { id, name: "Project X" };
  }
]);
`;

  let SERVER_ACTION_ARRAY_CODE = `
"use server";
export const upvote = serverAction([
  auth,
  async (id) => {
    return { id, count: 1 };
  }
]);
`;

  let SERVER_QUERY_ARRAY_POST_CODE = `
"use server";
export const getProject = serverQuery([
  auth,
  async (id) => {
    return { id, name: "Project X" };
  }
], { method: "POST" });
`;

  const TEST_CASES = {
    COMMENT_CODE,
    MULTI_LINE_COMMENT_CODE,
    COMMENT_BLOCK_CODE,
    DEFAULT_EXPORT_CODE,
    NAMED_EXPORT_CODE,
    ARROW_FUNCTION_EXPORT_CODE,
    ASYNC_FUNCTION_EXPORT_CODE,
    DEFAULT_AND_NAMED_EXPORTS_CODE,
    RE_EXPORT_CODE,
    PREDEFINED_DEFAULT_EXPORT_CODE,
    EXPORT_DEFAULT_FUNCTION_CODE,
    SERVER_QUERY_GET_CODE,
    SERVER_QUERY_POST_CODE,
    SERVER_ACTION_CODE,
    SERVER_QUERY_DEFAULT_CODE,
    SERVER_ACTION_DEFAULT_CODE,
    SERVER_QUERY_ARRAY_CODE,
    SERVER_ACTION_ARRAY_CODE,
    SERVER_QUERY_ARRAY_POST_CODE,
  };

  describe("TRANSFORMS", () => {
    for (const [key, CODE] of Object.entries(TEST_CASES)) {
      describe(key, () => {
        it(`CLIENT`, () => {
          const result = transformServerFunctions(
            CODE,
            "/test.tsx",
            "client",
            new Set(),
          );
          expect(result?.code).toMatchSnapshot();
        });

        it(`WORKER`, () => {
          const result = transformServerFunctions(
            CODE,
            "/test.tsx",
            "worker",
            new Set(),
          );
          expect(result?.code).toMatchSnapshot();
        });

        it(`SSR`, () => {
          const result = transformServerFunctions(
            CODE,
            "/test.tsx",
            "ssr",
            new Set(),
          );
          expect(result?.code).toMatchSnapshot();
        });
      });
    }
  });
});
