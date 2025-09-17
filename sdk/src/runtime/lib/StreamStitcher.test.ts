import { describe, it, expect } from "vitest";
import { StreamStitcher } from "./StreamStitcher.js";

// Helper function to create a ReadableStream from a string
function createStreamFromString(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(content));
      controller.close();
    },
  });
}

// Helper function to read a stream to a string
async function streamToString(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode(); // Flush any remaining bytes
  } finally {
    reader.releaseLock();
  }

  return result;
}

describe("StreamStitcher", () => {
  describe("string replacements", () => {
    it("should replace a simple string", async () => {
      const input = createStreamFromString("<head></head><body>content</body>");
      const stitcher = new StreamStitcher({
        stringReplacements: [
          { search: "</head>", replace: "<script>injected</script></head>" },
        ],
        streamReplacements: [],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe(
        "<head><script>injected</script></head><body>content</body>",
      );
    });

    it("should handle async string replacement functions", async () => {
      const input = createStreamFromString("<head></head><body>content</body>");
      const stitcher = new StreamStitcher({
        stringReplacements: [
          {
            search: "</head>",
            replace: async () => {
              // Simulate async operation
              await new Promise((resolve) => setTimeout(resolve, 1));
              return "<script>async-injected</script></head>";
            },
          },
        ],
        streamReplacements: [],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe(
        "<head><script>async-injected</script></head><body>content</body>",
      );
    });

    it("should pass through content unchanged when no replacements match", async () => {
      const input = createStreamFromString(
        "<html><body>no matches here</body></html>",
      );
      const stitcher = new StreamStitcher({
        stringReplacements: [{ search: "</head>", replace: "replacement" }],
        streamReplacements: [],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("<html><body>no matches here</body></html>");
    });
  });

  describe("stream replacements", () => {
    it("should replace a placeholder with stream content", async () => {
      const input = createStreamFromString("<div>__PLACEHOLDER__</div>");
      const replacementStream = createStreamFromString(
        "<p>injected content</p>",
      );

      const stitcher = new StreamStitcher({
        stringReplacements: [],
        streamReplacements: [
          { placeholder: "__PLACEHOLDER__", stream: replacementStream },
        ],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("<div><p>injected content</p></div>");
    });

    it("should handle placeholder at the beginning of content", async () => {
      const input = createStreamFromString("__PLACEHOLDER__<div>after</div>");
      const replacementStream = createStreamFromString("<p>before</p>");

      const stitcher = new StreamStitcher({
        stringReplacements: [],
        streamReplacements: [
          { placeholder: "__PLACEHOLDER__", stream: replacementStream },
        ],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("<p>before</p><div>after</div>");
    });

    it("should handle placeholder at the end of content", async () => {
      const input = createStreamFromString("<div>before</div>__PLACEHOLDER__");
      const replacementStream = createStreamFromString("<p>after</p>");

      const stitcher = new StreamStitcher({
        stringReplacements: [],
        streamReplacements: [
          { placeholder: "__PLACEHOLDER__", stream: replacementStream },
        ],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("<div>before</div><p>after</p>");
    });
  });

  describe("combined replacements", () => {
    it("should handle both string and stream replacements", async () => {
      const input = createStreamFromString("<head></head><body>__APP__</body>");
      const appStream = createStreamFromString("<div>app content</div>");

      const stitcher = new StreamStitcher({
        stringReplacements: [
          { search: "</head>", replace: "<script>preamble</script></head>" },
        ],
        streamReplacements: [{ placeholder: "__APP__", stream: appStream }],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe(
        "<head><script>preamble</script></head><body><div>app content</div></body>",
      );
    });

    it("should process replacements in order of appearance", async () => {
      const input = createStreamFromString("__FIRST____SECOND__");
      const firstStream = createStreamFromString("A");
      const secondStream = createStreamFromString("B");

      const stitcher = new StreamStitcher({
        stringReplacements: [],
        streamReplacements: [
          { placeholder: "__FIRST__", stream: firstStream },
          { placeholder: "__SECOND__", stream: secondStream },
        ],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("AB");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input stream", async () => {
      const input = createStreamFromString("");
      const stitcher = new StreamStitcher({
        stringReplacements: [{ search: "test", replace: "replacement" }],
        streamReplacements: [],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("");
    });

    it("should handle empty replacement stream", async () => {
      const input = createStreamFromString("before__PLACEHOLDER__after");
      const emptyStream = createStreamFromString("");

      const stitcher = new StreamStitcher({
        stringReplacements: [],
        streamReplacements: [
          { placeholder: "__PLACEHOLDER__", stream: emptyStream },
        ],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      expect(result).toBe("beforeafter");
    });

    it("should handle multiple occurrences of the same search string", async () => {
      const input = createStreamFromString("test test test");
      const stitcher = new StreamStitcher({
        stringReplacements: [{ search: "test", replace: "replaced" }],
        streamReplacements: [],
      });

      const output = input.pipeThrough(stitcher);
      const result = await streamToString(output);

      // Should only replace the first occurrence in each chunk
      expect(result).toBe("replaced test test");
    });
  });
});
