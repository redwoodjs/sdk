import { describe, it, expect } from "vitest";
import { BodyContentExtractor } from "./streamExtractors.js";

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
      if (done) {
        break;
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

describe("BodyContentExtractor Debug", () => {
  it("should extract simple body content", async () => {
    const html = "<html><body><div>content</div></body></html>";
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    console.log("Input:", html);
    console.log("Output:", result);
    expect(result).toBe("<div>content</div>");
  });

  it("should handle body with attributes", async () => {
    const html = '<html><body class="main"><div>content</div></body></html>';
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    console.log("Input:", html);
    console.log("Output:", result);
    expect(result).toBe("<div>content</div>");
  });
});
