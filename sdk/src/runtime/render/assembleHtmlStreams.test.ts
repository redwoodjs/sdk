import { describe, it, expect } from "vitest";
import { assembleHtmlStreams } from "./assembleHtmlStreams.js";

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

describe("assembleHtmlStreams", () => {
  it("should extract preamble from React shell and inject into document head", async () => {
    const reactShellStream = createStreamFromString(
      "<html><head><script>window.__REACT_STATE__={}</script></head><body><div>app content</div></body></html>",
    );
    const documentStream = createStreamFromString(
      "<html><head><title>My App</title></head><body>__PLACEHOLDER__</body></html>",
    );
    const placeholder = "__PLACEHOLDER__";

    const result = assembleHtmlStreams({
      reactShellStream,
      documentStream,
      placeholder,
    });

    const output = await streamToString(result);
    expect(output).toBe(
      "<html><head><title>My App</title><script>window.__REACT_STATE__={}</script></head><body><div>app content</div></body></html>",
    );
  });

  it("should handle empty preamble gracefully", async () => {
    const reactShellStream = createStreamFromString(
      "<html><head></head><body><div>app content</div></body></html>",
    );
    const documentStream = createStreamFromString(
      "<html><head><title>My App</title></head><body>__PLACEHOLDER__</body></html>",
    );
    const placeholder = "__PLACEHOLDER__";

    const result = assembleHtmlStreams({
      reactShellStream,
      documentStream,
      placeholder,
    });

    const output = await streamToString(result);
    expect(output).toBe(
      "<html><head><title>My App</title></head><body><div>app content</div></body></html>",
    );
  });

  it("should handle React shell without head tag", async () => {
    const reactShellStream = createStreamFromString(
      "<html><body><div>app content</div></body></html>",
    );
    const documentStream = createStreamFromString(
      "<html><head><title>My App</title></head><body>__PLACEHOLDER__</body></html>",
    );
    const placeholder = "__PLACEHOLDER__";

    const result = assembleHtmlStreams({
      reactShellStream,
      documentStream,
      placeholder,
    });

    const output = await streamToString(result);
    expect(output).toBe(
      "<html><head><title>My App</title></head><body><div>app content</div></body></html>",
    );
  });

  it("should handle complex preamble with multiple script tags", async () => {
    const reactShellStream = createStreamFromString(
      '<html><head><script>window.__REACT_STATE__={}</script><script nonce="abc123">window.__HYDRATION_DATA__={}</script></head><body><div id="root"><span>complex app</span></div></body></html>',
    );
    const documentStream = createStreamFromString(
      '<html><head><meta charset="utf-8"><title>Complex App</title></head><body><div class="container">__PLACEHOLDER__</div></body></html>',
    );
    const placeholder = "__PLACEHOLDER__";

    const result = assembleHtmlStreams({
      reactShellStream,
      documentStream,
      placeholder,
    });

    const output = await streamToString(result);
    expect(output).toBe(
      '<html><head><meta charset="utf-8"><title>Complex App</title><script>window.__REACT_STATE__={}</script><script nonce="abc123">window.__HYDRATION_DATA__={}</script></head><body><div class="container"><div id="root"><span>complex app</span></div></div></body></html>',
    );
  });

  it("should preserve document structure when placeholder is not found", async () => {
    const reactShellStream = createStreamFromString(
      "<html><head><script>state</script></head><body><div>app</div></body></html>",
    );
    const documentStream = createStreamFromString(
      "<html><head><title>App</title></head><body><div>no placeholder here</div></body></html>",
    );
    const placeholder = "__MISSING_PLACEHOLDER__";

    const result = assembleHtmlStreams({
      reactShellStream,
      documentStream,
      placeholder,
    });

    const output = await streamToString(result);
    expect(output).toBe(
      "<html><head><title>App</title><script>state</script></head><body><div>no placeholder here</div></body></html>",
    );
  });

  it("should handle streaming chunks that split across HTML boundaries", async () => {
    const encoder = new TextEncoder();
    const reactShellStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("<html><head><script>window.__"));
        controller.enqueue(encoder.encode("STATE__={}</script></head><body>"));
        controller.enqueue(
          encoder.encode("<div>chunked content</div></body></html>"),
        );
        controller.close();
      },
    });

    const documentStream = createStreamFromString(
      "<html><head><title>Chunked</title></head><body>__PLACEHOLDER__</body></html>",
    );
    const placeholder = "__PLACEHOLDER__";

    const result = assembleHtmlStreams({
      reactShellStream,
      documentStream,
      placeholder,
    });

    const output = await streamToString(result);
    expect(output).toBe(
      "<html><head><title>Chunked</title><script>window.__STATE__={}</script></head><body><div>chunked content</div></body></html>",
    );
  });
});
