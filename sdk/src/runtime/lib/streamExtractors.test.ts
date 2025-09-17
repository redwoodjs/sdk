import { describe, it, expect } from "vitest";
import { PreambleExtractor, BodyContentExtractor } from "./streamExtractors.js";

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

describe("PreambleExtractor", () => {
  it("should extract content between <head> tags", async () => {
    const html =
      "<html><head>preamble content</head><body>rest of doc</body></html>";
    const stream = createStreamFromString(html);
    const extractor = new PreambleExtractor();

    stream.pipeTo(extractor);

    const preamble = await extractor.preamble;
    expect(preamble).toBe("preamble content");
  });

  it("should handle empty head tags", async () => {
    const html = "<html><head></head><body>rest of doc</body></html>";
    const stream = createStreamFromString(html);
    const extractor = new PreambleExtractor();

    stream.pipeTo(extractor);

    const preamble = await extractor.preamble;
    expect(preamble).toBe("");
  });

  it("should return empty string if </head> is not found", async () => {
    const html = "<html><head>no closing tag";
    const stream = createStreamFromString(html);
    const extractor = new PreambleExtractor();

    stream.pipeTo(extractor);

    const preamble = await extractor.preamble;
    expect(preamble).toBe("");
  });

  it("should handle chunks splitting the sentinel", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("<html><head>preamble</he"));
        controller.enqueue(encoder.encode("ad><body></body></html>"));
        controller.close();
      },
    });

    const extractor = new PreambleExtractor();
    stream.pipeTo(extractor);

    const preamble = await extractor.preamble;
    expect(preamble).toBe("preamble");
  });

  it("should extract content within the head tag", async () => {
    const extractor = new PreambleExtractor();
    const stream = createStreamFromString(
      '<!DOCTYPE html><html><head><script src="some-script.js"></script><link rel="stylesheet" href="styles.css">',
    );
    await stream.pipeTo(extractor);
    const preamble = await extractor.preamble;
    expect(preamble).toBe(
      '<!DOCTYPE html><html><head><script src="some-script.js"></script><link rel="stylesheet" href="styles.css">',
    );
  });

  it("should handle an empty head tag", async () => {
    const extractor = new PreambleExtractor();
    const stream = createStreamFromString("<html><head>");
    await stream.pipeTo(extractor);
    const preamble = await extractor.preamble;
    expect(preamble).toBe("<html><head>");
  });

  it("should handle streams that end before the head tag is closed", async () => {
    const extractor = new PreambleExtractor();
    const stream = createStreamFromString("<html><head>no closing tag");
    await stream.pipeTo(extractor);
    const preamble = await extractor.preamble;
    expect(preamble).toBe("");
  });

  it("should handle multiple chunks correctly", async () => {
    const extractor = new PreambleExtractor();
    const stream = createStreamFromString(
      '<html><head><title>Test</title><link rel="stylesheet" href="style.css">',
    );
    await stream.pipeTo(extractor);
    const preamble = await extractor.preamble;
    expect(preamble).toBe(
      '<html><head><title>Test</title><link rel="stylesheet" href="style.css">',
    );
  });
});

describe("BodyContentExtractor", () => {
  it("should extract content between <body> tags", async () => {
    const html = "<html><head></head><body><p>body content</p></body></html>";
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("<p>body content</p>");
  });

  it("should handle empty body", async () => {
    const html = "<html><head></head><body></body></html>";
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("");
  });

  it("should handle chunks splitting the <body> tag", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("<html><head></head><bo"));
        controller.enqueue(encoder.encode("dy>content</body></html>"));
        controller.close();
      },
    });

    const extractor = new BodyContentExtractor();
    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("content");
  });

  it("should handle chunks splitting the </body> tag", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("<html><body>content</bo"));
        controller.enqueue(encoder.encode("dy></html>"));
        controller.close();
      },
    });

    const extractor = new BodyContentExtractor();
    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("content");
  });

  it("should handle stream ending before </body> is found", async () => {
    const html = "<html><body><p>no closing tag";
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("<p>no closing tag");
  });

  it("should not output content before <body>", async () => {
    const html = "before<body>content</body>";
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("content");
  });

  it("should not output content after </body>", async () => {
    const html = "<body>content</body>after";
    const stream = createStreamFromString(html);
    const extractor = new BodyContentExtractor();

    const result = await streamToString(stream.pipeThrough(extractor));
    expect(result).toBe("content");
  });
});
