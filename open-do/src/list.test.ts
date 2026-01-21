import { expect, test, describe } from "vitest";
import { OpenDORegistry as Registry } from "./registry.js";
import { OpenDO, DurableObjectState } from "./open-do.js";

class ListDO extends OpenDO {
  async fetch(request: Request) {
    return new Response("OK");
  }
}

describe("DurableObjectStorage.list()", () => {
  test("should support startAfter with reverse: true (lexicographical)", async () => {
    const registry = new Registry();
    const myDo = await registry.get("test-list-reverse", ListDO);
    await myDo.storage.deleteAll();

    await myDo.storage.put({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4,
      "e": 5
    });

    // Ascending order: a, b, c, d, e
    // startAfter: "c" -> d, e
    const listAsc = await myDo.storage.list({ startAfter: "c" });
    expect(Array.from(listAsc.keys())).toEqual(["d", "e"]);

    // Descending order (reverse: true): e, d, c, b, a
    // startAfter: "c" -> b, a
    // CURRENT BUG: This returns ["e", "d"] because it uses WHERE key > 'c'
    const listDesc = await myDo.storage.list({ startAfter: "c", reverse: true });
    expect(Array.from(listDesc.keys())).toEqual(["b", "a"]);
  });

  test("should support start with reverse: true", async () => {
    const registry = new Registry();
    const myDo = await registry.get("test-list-start-reverse", ListDO);
    await myDo.storage.deleteAll();

    await myDo.storage.put({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4,
      "e": 5
    });

    // Descending order (reverse: true): e, d, c, b, a
    // start: "c" -> c, b, a
    // CURRENT BUG: This returns ["e", "d", "c"] because it uses WHERE key >= 'c'
    const listDesc = await myDo.storage.list({ start: "c", reverse: true });
    expect(Array.from(listDesc.keys())).toEqual(["c", "b", "a"]);
  });
  
  test("should support end with reverse: true", async () => {
    const registry = new Registry();
    const myDo = await registry.get("test-list-end-reverse", ListDO);
    await myDo.storage.deleteAll();

    await myDo.storage.put({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4,
      "e": 5
    });

    // Descending order: e, d, c, b, a
    // end: "c" -> e, d
    // CURRENT BUG: This returns [] because it uses WHERE key < 'c'
    const listDesc = await myDo.storage.list({ end: "c", reverse: true });
    expect(Array.from(listDesc.keys())).toEqual(["e", "d"]);
  });
});
