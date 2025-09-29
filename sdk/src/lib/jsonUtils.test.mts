import { describe, expect, it } from "vitest";
import { extractAllJson, extractLastJson, parseJson } from "./jsonUtils.mjs";

describe("jsonUtils", () => {
  describe("extractLastJson", () => {
    it("should extract the last JSON object from a string", () => {
      const output =
        'some text {"a":1} some other text {"b":2, "c": {"d": 3}} end';
      expect(extractLastJson(output)).toEqual({ b: 2, c: { d: 3 } });
    });

    it("should extract the last JSON array from a string", () => {
      const output = "start [1, 2] middle [3, 4, [5]] end";
      expect(extractLastJson(output)).toEqual([3, 4, [5]]);
    });

    it("should return the object if the string is just JSON", () => {
      const output = '{"a":1}';
      expect(extractLastJson(output)).toEqual({ a: 1 });
    });

    it("should handle nested structures correctly", () => {
      const output = '{"a":{"b":{"c":"d"}}}';
      expect(extractLastJson(output)).toEqual({ a: { b: { c: "d" } } });
    });

    it("should return null if no valid JSON is found", () => {
      const output = "this is just some text without json";
      expect(extractLastJson(output)).toBeNull();
    });

    it("should return null for malformed JSON", () => {
      const output = '{"a":1, "b":}';
      expect(extractLastJson(output)).toBeNull();
    });

    it("should handle undefined and empty string input", () => {
      expect(extractLastJson(undefined)).toBeNull();
      expect(extractLastJson("")).toBeNull();
    });
  });

  describe("extractAllJson", () => {
    it("should extract all JSON objects from a string", () => {
      const output = '{"a":1} some text {"b":2} and then {"c":3, "d": [4]}';
      expect(extractAllJson(output)).toEqual([
        { a: 1 },
        { b: 2 },
        { c: 3, d: [4] },
      ]);
    });

    it("should extract all JSON arrays from a string", () => {
      const output = "[1,2] then [3,4]";
      expect(extractAllJson(output)).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("should handle a mix of objects and arrays", () => {
      const output = '{"a":1} [2,3] {"b":4}';
      expect(extractAllJson(output)).toEqual([{ a: 1 }, [2, 3], { b: 4 }]);
    });

    it("should return an empty array if no JSON is found", () => {
      const output = "no json here";
      expect(extractAllJson(output)).toEqual([]);
    });

    it("should ignore malformed JSON", () => {
      const output = '{"a":1} {"b":2,} [3,4]';
      expect(extractAllJson(output)).toEqual([{ a: 1 }, [3, 4]]);
    });
  });

  describe("parseJson", () => {
    it("should parse the last JSON object by default", () => {
      const output = '{"a":1} {"b":2}';
      expect(parseJson(output, {})).toEqual({ b: 2 });
    });

    it("should return the default value if no JSON is found", () => {
      const output = "no json";
      expect(parseJson(output, { default: true })).toEqual({ default: true });
    });

    it("should find an object with a uuid property when requested", () => {
      const output = '{"a":1} {"uuid":"123-abc", "data": "yes"} {"c":3}';
      expect(parseJson(output, {}, true)).toEqual({
        uuid: "123-abc",
        data: "yes",
      });
    });

    it("should return the last object if findUuid is true but no object with uuid is found", () => {
      const output = '{"a":1} {"b":2}';
      expect(parseJson(output, {}, true)).toEqual({ b: 2 });
    });

    it("should return the default value if findUuid is true and no JSON is found", () => {
      const output = "no json";
      expect(parseJson(output, { default: true }, true)).toEqual({
        default: true,
      });
    });
  });
});
