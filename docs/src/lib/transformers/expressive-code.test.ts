import { describe, expect, it } from "vitest";
import {
  parseInlineMarkdown,
  parseMeta,
  parseRanges,
  transformerExpressiveCode,
} from "./expressive-code";

// -- Pure function tests --

describe("parseRanges", () => {
  it("parses a single line number", () => {
    expect(parseRanges("2")).toEqual([[2, 2]]);
  });

  it("parses a range", () => {
    expect(parseRanges("2-5")).toEqual([[2, 5]]);
  });

  it("parses comma-separated values", () => {
    expect(parseRanges("1, 3-5, 8")).toEqual([
      [1, 1],
      [3, 5],
      [8, 8],
    ]);
  });

  it("ignores invalid entries", () => {
    expect(parseRanges("abc, 2, -")).toEqual([[2, 2]]);
  });

  it("returns empty for empty string", () => {
    expect(parseRanges("")).toEqual([]);
  });
});

describe("parseMeta", () => {
  it("parses collapse ranges", () => {
    expect(parseMeta("collapse={2-3}")).toEqual({
      collapse: [[2, 3]],
      withOutput: false,
    });
  });

  it("parses withOutput flag", () => {
    expect(parseMeta("withOutput")).toEqual({
      collapse: [],
      withOutput: true,
    });
  });

  it("parses both together", () => {
    expect(parseMeta("collapse={1,4-5} withOutput")).toEqual({
      collapse: [
        [1, 1],
        [4, 5],
      ],
      withOutput: true,
    });
  });

  it("returns defaults for empty string", () => {
    expect(parseMeta("")).toEqual({ collapse: [], withOutput: false });
  });
});

describe("parseInlineMarkdown", () => {
  it("returns plain text as-is", () => {
    expect(parseInlineMarkdown("hello world")).toEqual([
      { type: "text", value: "hello world" },
    ]);
  });

  it("wraps backtick content in code elements", () => {
    expect(parseInlineMarkdown("Use `const` here")).toEqual([
      { type: "text", value: "Use " },
      {
        type: "element",
        tagName: "code",
        properties: {},
        children: [{ type: "text", value: "const" }],
      },
      { type: "text", value: " here" },
    ]);
  });

  it("handles multiple inline code spans", () => {
    const result = parseInlineMarkdown("`a` and `b`");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      type: "element",
      tagName: "code",
      properties: {},
      children: [{ type: "text", value: "a" }],
    });
    expect(result[2]).toEqual({
      type: "element",
      tagName: "code",
      properties: {},
      children: [{ type: "text", value: "b" }],
    });
  });
});

// -- Integration tests through the transformer --

function line(...texts: string[]) {
  return {
    type: "element" as const,
    tagName: "span",
    properties: { class: "line" },
    children: texts.map((t) => ({ type: "text" as const, value: t })),
  };
}

/** Empty line — used as the command/output separator in withOutput blocks. */
function emptyLine() {
  return line();
}

/** Line with class as an array, to test the array-class branch of isLineElement. */
function lineWithArrayClass(...texts: string[]) {
  return {
    type: "element" as const,
    tagName: "span",
    properties: { class: ["line"] as string[] },
    children: texts.map((t) => ({ type: "text" as const, value: t })),
  };
}

type LineNode = ReturnType<typeof line>;
type CodeNode = { type: "element"; tagName: string; properties: Record<string, unknown>; children: any[] };

function makeTree(lines: (LineNode | ReturnType<typeof lineWithArrayClass>)[], meta = "", lang = "sh") {
  const codeChildren: (LineNode | ReturnType<typeof lineWithArrayClass> | { type: "text"; value: string })[] = [];
  for (let i = 0; i < lines.length; i++) {
    codeChildren.push(lines[i]);
    if (i < lines.length - 1) codeChildren.push({ type: "text", value: "\n" });
  }

  const preNode = {
    type: "element" as const,
    tagName: "pre",
    properties: {} as Record<string, unknown>,
    children: [
      {
        type: "element" as const,
        tagName: "code",
        properties: {},
        children: codeChildren,
      },
    ],
  };

  const transformer = transformerExpressiveCode();
  const ctx = { options: { lang, meta: { __raw: meta } } };
  transformer.pre!.call(ctx, preNode);

  return preNode;
}

describe("transformerExpressiveCode", () => {
  describe("collapse", () => {
    it("wraps collapsed lines in details/summary", () => {
      const tree = makeTree(
        [line("line 1"), line("line 2"), line("line 3"), line("line 4")],
        "collapse={2-3}",
      );

      const code = tree.children[0];
      const details = code.children.find(
        (c: any) => c.type === "element" && c.tagName === "details",
      );
      expect(details).toBeDefined();
      expect(details.properties.class).toBe("ec-collapsed-section");
      expect(details.children[0].tagName).toBe("summary");
      expect(details.children[0].children[0].value).toContain(
        "2 collapsed lines",
      );
    });

    it("uses singular 'line' for single collapsed line", () => {
      const tree = makeTree(
        [line("line 1"), line("line 2"), line("line 3")],
        "collapse={2}",
      );

      const code = tree.children[0];
      const details = code.children.find(
        (c: any) => c.type === "element" && c.tagName === "details",
      );
      const summaryText = details.children[0].children[0].value;
      expect(summaryText).toContain("1 collapsed line");
      expect(summaryText).not.toContain("lines");
    });

    it("creates separate details for non-contiguous ranges", () => {
      const tree = makeTree(
        [
          line("line 1"),
          line("line 2"),
          line("line 3"),
          line("line 4"),
          line("line 5"),
        ],
        "collapse={1,4-5}",
      );

      const code = tree.children[0];
      const detailsCount = code.children.filter(
        (c: any) => c.type === "element" && c.tagName === "details",
      ).length;
      expect(detailsCount).toBe(2);
    });

    it("does nothing without collapse meta", () => {
      const tree = makeTree([line("line 1"), line("line 2")]);
      const code = tree.children[0];
      expect(
        code.children.some(
          (c: any) => c.type === "element" && c.tagName === "details",
        ),
      ).toBe(false);
    });

    it("handles lines with array-style class property", () => {
      const tree = makeTree(
        [lineWithArrayClass("line 1"), lineWithArrayClass("line 2"), lineWithArrayClass("line 3")],
        "collapse={2}",
      );

      const code = tree.children[0] as CodeNode;
      const details = code.children.find(
        (c: any) => c.type === "element" && c.tagName === "details",
      );
      expect(details).toBeDefined();
    });

    it("handles out-of-range collapse values gracefully", () => {
      const tree = makeTree([line("line 1"), line("line 2")], "collapse={99}");
      const code = tree.children[0];
      expect(
        code.children.some(
          (c: any) => c.type === "element" && c.tagName === "details",
        ),
      ).toBe(false);
    });
  });

  describe("withOutput", () => {
    it("splits at empty line into command and output sections", () => {
      const tree = makeTree(
        [line("npm install"), emptyLine(), line("added 50 packages")],
        "withOutput",
      );

      // Command stays in <code> with ec-command class
      const code = tree.children[0];
      expect(
        code.children.some(
          (c: any) => c.properties?.class?.includes("ec-command"),
        ),
      ).toBe(true);

      // Output moved to sibling div in <pre>
      const outputSection = tree.children.find(
        (c: any) => c.properties?.class?.includes("ec-output-section"),
      );
      expect(outputSection).toBeDefined();
      expect(
        outputSection.children.some(
          (c: any) => c.properties?.class?.includes("ec-output"),
        ),
      ).toBe(true);
    });

    it("does nothing without withOutput meta", () => {
      const tree = makeTree([line("line 1"), emptyLine(), line("line 2")]);
      expect(tree.children).toHaveLength(1);
    });

    it("does nothing when there is no empty line", () => {
      const tree = makeTree([line("line 1"), line("line 2")], "withOutput");
      expect(tree.children).toHaveLength(1);
    });
  });

  describe("footnotes", () => {
    it("extracts footnote between --- delimiters", () => {
      const tree = makeTree([
        line("const x = 1;"),
        line("---"),
        line("This is a footnote"),
        line("---"),
      ]);

      const footnote = tree.children.find(
        (c: any) => c.properties?.class === "ec-footnote",
      );
      expect(footnote).toBeDefined();
      expect(footnote.children[0].value).toBe("This is a footnote");
    });

    it("renders inline code in footnotes", () => {
      const tree = makeTree([
        line("const x = 1;"),
        line("---"),
        line("Use `const` for constants"),
        line("---"),
      ]);

      const footnote = tree.children.find(
        (c: any) => c.properties?.class === "ec-footnote",
      );
      const inlineCode = footnote.children.find(
        (c: any) => c.tagName === "code",
      );
      expect(inlineCode).toBeDefined();
      expect(inlineCode.children[0].value).toBe("const");
    });

    it("removes footnote lines from code block", () => {
      const tree = makeTree([
        line("const x = 1;"),
        line("---"),
        line("footnote"),
        line("---"),
      ]);

      const code = tree.children[0];
      const spans = code.children.filter(
        (c: any) => c.type === "element" && c.tagName === "span",
      );
      expect(spans).toHaveLength(1);
    });

    it("ignores blocks without --- delimiters", () => {
      const tree = makeTree([line("line 1"), line("line 2")]);
      expect(tree.children).toHaveLength(1);
    });

    it("ignores blocks with only one --- delimiter", () => {
      const tree = makeTree([line("line 1"), line("---"), line("not footnote")]);
      expect(tree.children).toHaveLength(1);
    });

    it("joins multiple footnote lines with spaces", () => {
      const tree = makeTree([
        line("const x = 1;"),
        line("---"),
        line("First line."),
        line("Second line."),
        line("---"),
      ]);

      const footnote = tree.children.find(
        (c: any) => c.properties?.class === "ec-footnote",
      );
      expect(footnote).toBeDefined();
      expect(footnote.children[0].value).toBe("First line. Second line.");
    });
  });

  describe("line numbers", () => {
    it.each(["ts", "js", "tsx", "jsx", "css", "typescript", "javascript"])(
      "auto-enables for %s",
      (lang) => {
        const tree = makeTree([line("code")], "", lang);
        expect(tree.properties["data-line-numbers"]).toBe(true);
      },
    );

    it.each(["sh", "bash", "json", "yaml", "md"])(
      "does not add for %s",
      (lang) => {
        const tree = makeTree([line("code")], "", lang);
        expect(tree.properties["data-line-numbers"]).toBeUndefined();
      },
    );

    it("does not override existing data-line-numbers", () => {
      const preNode = {
        type: "element" as const,
        tagName: "pre",
        properties: { "data-line-numbers": "custom" } as Record<
          string,
          unknown
        >,
        children: [
          {
            type: "element" as const,
            tagName: "code",
            properties: {},
            children: [line("const x = 1;")],
          },
        ],
      };

      const transformer = transformerExpressiveCode();
      transformer.pre!.call(
        { options: { lang: "ts", meta: { __raw: "" } } },
        preNode,
      );

      expect(preNode.properties["data-line-numbers"]).toBe("custom");
    });
  });

  describe("combined features", () => {
    it("handles collapse + footnote together", () => {
      const tree = makeTree(
        [
          line("line 1"),
          line("line 2"),
          line("line 3"),
          line("---"),
          line("A footnote"),
          line("---"),
        ],
        "collapse={2}",
      );

      expect(
        tree.children[0].children.some(
          (c: any) => c.tagName === "details",
        ),
      ).toBe(true);
      expect(
        tree.children.some(
          (c: any) => c.properties?.class === "ec-footnote",
        ),
      ).toBe(true);
    });

    it("handles collapse + withOutput together", () => {
      const tree = makeTree(
        [
          line("import foo"),
          line("import bar"),
          line("foo()"),
          emptyLine(),
          line("output here"),
        ],
        "collapse={1-2} withOutput",
      );

      const code = tree.children[0] as CodeNode;
      expect(
        code.children.some((c: any) => c.tagName === "details"),
      ).toBe(true);
      expect(
        tree.children.some((c: any) =>
          c.properties?.class?.includes("ec-output-section"),
        ),
      ).toBe(true);
    });

    it("handles withOutput + footnote together", () => {
      const tree = makeTree(
        [
          line("npm install"),
          emptyLine(),
          line("added 50 packages"),
          line("---"),
          line("Installs dependencies"),
          line("---"),
        ],
        "withOutput",
      );

      expect(
        tree.children.some((c: any) =>
          c.properties?.class?.includes("ec-output-section"),
        ),
      ).toBe(true);
      expect(
        tree.children.some(
          (c: any) => c.properties?.class === "ec-footnote",
        ),
      ).toBe(true);
    });
  });
});
