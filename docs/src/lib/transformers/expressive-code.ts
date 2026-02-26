/**
 * Minimal Shiki transformer for Expressive Code features that have no native
 * Shiki equivalent: collapse, withOutput, and footnotes.
 *
 * Collapsed lines are wrapped in <details>/<summary> elements so users can
 * expand them.
 *
 * Footnotes (--- delimited sections at the end of code blocks) are extracted
 * and rendered as a styled footer below the code.
 *
 * All other EC features (mark, ins, del, word highlights, line numbers, etc.)
 * are handled by native Shiki notation in the MDX files themselves.
 */

type HastNode = HastElement | HastText;

interface HastElement {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: HastNode[];
}

interface HastText {
  type: "text";
  value: string;
}

interface ShikiTransformerContext {
  options: { meta?: { __raw?: string } };
}

interface ShikiTransformer {
  name: string;
  pre?: (this: ShikiTransformerContext, node: HastElement) => void;
  line?: (
    this: ShikiTransformerContext,
    node: HastElement,
    line: number,
  ) => void;
}

function parseRanges(str: string): Array<[number, number]> {
  return str.split(",").flatMap((part) => {
    const trimmed = part.trim();
    const match = trimmed.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return [];
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    return [[start, end] as [number, number]];
  });
}

function isInRange(line: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => line >= start && line <= end);
}

interface ParsedMeta {
  collapse: Array<[number, number]>;
  withOutput: boolean;
}

function parseMeta(raw: string): ParsedMeta {
  let meta = raw;

  let collapse: Array<[number, number]> = [];
  meta = meta.replace(/collapse=\{([^}]+)\}/g, (_, ranges) => {
    collapse = parseRanges(ranges);
    return "";
  });

  let withOutput = false;
  meta = meta.replace(/\bwithOutput\b/g, () => {
    withOutput = true;
    return "";
  });

  return { collapse, withOutput };
}

const metaCache = new WeakMap<object, ParsedMeta>();

function getMeta(ctx: ShikiTransformerContext): ParsedMeta {
  const key = ctx.options;
  if (metaCache.has(key)) return metaCache.get(key)!;
  const parsed = parseMeta(ctx.options.meta?.__raw ?? "");
  metaCache.set(key, parsed);
  return parsed;
}

/**
 * Check if a HAST node is a line element (<span class="line">).
 * HAST uses `properties.class` (not `className`).
 */
function isLineElement(node: HastNode): node is HastElement {
  if (node.type !== "element") return false;
  const el = node as HastElement;
  if (el.tagName !== "span") return false;
  const cls = el.properties?.class;
  if (typeof cls === "string") return cls === "line" || cls.split(" ").includes("line");
  if (Array.isArray(cls)) return cls.includes("line");
  return false;
}

function countCollapsedRun(
  lineNum: number,
  ranges: Array<[number, number]>,
): number {
  let count = 0;
  let n = lineNum;
  while (isInRange(n, ranges)) {
    count++;
    n++;
  }
  return count;
}

/**
 * Walk the children of the <code> element and wrap consecutive collapsed
 * lines in <details>/<summary> elements.
 */
function wrapCollapsedLines(
  codeNode: HastElement,
  collapseRanges: Array<[number, number]>,
): void {
  const oldChildren = codeNode.children;
  const newChildren: HastNode[] = [];
  let lineNum = 1;
  let i = 0;

  while (i < oldChildren.length) {
    const child = oldChildren[i];

    if (!isLineElement(child)) {
      newChildren.push(child);
      i++;
      continue;
    }

    if (!isInRange(lineNum, collapseRanges)) {
      newChildren.push(child);
      lineNum++;
      i++;
      continue;
    }

    // Start of a collapsed run — collect consecutive collapsed lines
    // and their interleaved newline text nodes.
    const runCount = countCollapsedRun(lineNum, collapseRanges);
    const collapsedChildren: HastNode[] = [];

    for (
      let collected = 0;
      collected < runCount && i < oldChildren.length;
    ) {
      const c = oldChildren[i];
      if (isLineElement(c)) {
        collapsedChildren.push(c);
        collected++;
        lineNum++;
        i++;
      } else {
        // Newline text node between lines — include in the group
        collapsedChildren.push(c);
        i++;
      }
    }

    const summary: HastElement = {
      type: "element",
      tagName: "summary",
      properties: {
        class: "ec-collapsed-summary",
      },
      children: [
        {
          type: "text",
          value: `\u21D5 ${runCount} collapsed line${runCount > 1 ? "s" : ""}`,
        },
      ],
    };

    const details: HastElement = {
      type: "element",
      tagName: "details",
      properties: {
        class: "ec-collapsed-section",
      },
      children: [summary, ...collapsedChildren],
    };

    newChildren.push(details);
  }

  codeNode.children = newChildren;
}

/** Get the plain text content of a HAST node recursively. */
function getTextContent(node: HastNode): string {
  if (node.type === "text") return node.value;
  return node.children.map(getTextContent).join("");
}

/** Check if a line element contains only "---". */
function isDelimiterLine(node: HastNode): boolean {
  if (!isLineElement(node)) return false;
  return getTextContent(node).trim() === "---";
}

/** Check if a line element is empty (whitespace only). */
function isEmptyLine(node: HastNode): boolean {
  if (!isLineElement(node)) return false;
  return getTextContent(node).trim() === "";
}

/** Parse backtick-wrapped text into HAST nodes with <code> elements. */
function parseInlineMarkdown(text: string): HastNode[] {
  const nodes: HastNode[] = [];
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    nodes.push({
      type: "element",
      tagName: "code",
      properties: {},
      children: [{ type: "text", value: match[1] }],
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push({ type: "text", value: text.slice(lastIndex) });
  }
  return nodes;
}

/**
 * Extract footnote content from the end of a code block.
 * EC footnote syntax: lines between --- delimiters at the end of a code fence.
 * Returns a footer element, or null if no footnote found.
 */
function extractFootnote(codeNode: HastElement): HastElement | null {
  const children = codeNode.children;

  // Scan backwards to find closing delimiter (skip trailing text/empty nodes)
  let closingIdx = -1;
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child.type === "text") continue;
    if (isEmptyLine(child)) continue;
    if (isDelimiterLine(child)) {
      closingIdx = i;
      break;
    }
    // Last meaningful line is not ---, no footnote
    return null;
  }
  if (closingIdx === -1) return null;

  // Scan backwards from before closing to find opening delimiter
  let openingIdx = -1;
  for (let i = closingIdx - 1; i >= 0; i--) {
    const child = children[i];
    if (isDelimiterLine(child)) {
      openingIdx = i;
      break;
    }
  }
  if (openingIdx === -1) return null;

  // Collect text content from lines between delimiters
  const footnoteLines: string[] = [];
  for (let i = openingIdx + 1; i < closingIdx; i++) {
    if (isLineElement(children[i])) {
      footnoteLines.push(getTextContent(children[i]));
    }
  }

  // Remove everything from before the opening delimiter to the end
  let removeStart = openingIdx;
  if (removeStart > 0 && children[removeStart - 1].type === "text") {
    removeStart--;
  }
  codeNode.children = children.slice(0, removeStart);

  const footnoteText = footnoteLines.join(" ").trim();
  if (!footnoteText) return null;

  return {
    type: "element",
    tagName: "div",
    properties: { class: "ec-footnote" },
    children: parseInlineMarkdown(footnoteText),
  };
}

export function transformerExpressiveCode(): ShikiTransformer {
  return {
    name: "custom:expressive-code-compat",

    pre(node) {
      const meta = getMeta(this);

      if (meta.withOutput) {
        node.properties["data-with-output"] = "";
      }

      const codeNode = node.children.find(
        (c): c is HastElement =>
          c.type === "element" && c.tagName === "code",
      );

      if (codeNode) {
        // Extract footnote first (before collapse, since it affects line count)
        const footnote = extractFootnote(codeNode);

        if (meta.collapse.length > 0) {
          wrapCollapsedLines(codeNode, meta.collapse);
        }

        if (footnote) {
          node.children.push(footnote);
        }
      }
    },
  };
}
