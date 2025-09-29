import { describe, expect, it } from "vitest";
import { MESSAGE_TYPE } from "./shared";

describe("Realtime Shared Constants", () => {
  it("MESSAGE_TYPE should match snapshot", () => {
    expect(MESSAGE_TYPE).toMatchInlineSnapshot(`
      {
        "ACTION_CHUNK": 5,
        "ACTION_END": 6,
        "ACTION_ERROR": 7,
        "ACTION_REQUEST": 3,
        "ACTION_START": 4,
        "RSC_CHUNK": 1,
        "RSC_END": 2,
        "RSC_START": 0,
      }
    `);
  });
});
