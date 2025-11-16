import { describe, expect, it } from "vitest";
import { stitchDocumentAndAppStreams } from "./stitchDocumentAndAppStreams.js";

function stringToStream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(str));
      controller.close();
    },
  });
}

function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let result = "";

  return new Promise((resolve, reject) => {
    function pump(): Promise<void> {
      return reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            resolve(result);
            return;
          }
          result += decoder.decode(value, { stream: true });
          return pump();
        })
        .catch(reject);
    }
    return pump();
  });
}

function createChunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < chunks.length; i++) {
        controller.enqueue(encoder.encode(chunks[i]));
      }
      controller.close();
    },
  });
}

describe("stitchDocumentAndAppStreams", () => {
  const startMarker = '<div id="rwsdk-app-start" />';
  const endMarker = '<div id="rwsdk-app-end"></div>';

  describe("basic stitching flow", () => {
    it("stitches document head, app shell, and document tail", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>App content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<!DOCTYPE html>`);
      expect(result).toContain(`<head>`);
      expect(result).toContain(`<meta charset="utf-8" />`);
      expect(result).toContain(`<div>App content</div>`);
      expect(result).toContain(`<script src="/client.js"></script>`);
      expect(result).toContain(`</body>`);
      expect(result).toContain(`</html>`);

      const doctypeIndex = result.indexOf(`<!DOCTYPE html>`);
      const appContentIndex = result.indexOf(`<div>App content</div>`);
      const scriptIndex = result.indexOf(`<script src="/client.js"></script>`);
      const bodyCloseIndex = result.indexOf(`</body>`);

      expect(doctypeIndex).toBeLessThan(appContentIndex);
      expect(appContentIndex).toBeLessThan(scriptIndex);
      expect(scriptIndex).toBeLessThan(bodyCloseIndex);
    });

    it("removes start marker from output", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>App content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).not.toContain(startMarker);
    });

    it("preserves end marker in output", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>App content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(endMarker);
    });
  });

  describe("suspense boundaries (suspended content)", () => {
    it("streams suspended content after script tag", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>Initial content</div>${endMarker}<div>Suspended content</div>`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div>Initial content</div>`);
      expect(result).toContain(`<script src="/client.js"></script>`);
      expect(result).toContain(`<div>Suspended content</div>`);

      const initialIndex = result.indexOf(`<div>Initial content</div>`);
      const scriptIndex = result.indexOf(`<script src="/client.js"></script>`);
      const suspendedIndex = result.indexOf(`<div>Suspended content</div>`);
      const bodyCloseIndex = result.indexOf(`</body>`);

      expect(initialIndex).toBeLessThan(scriptIndex);
      expect(scriptIndex).toBeLessThan(suspendedIndex);
      expect(suspendedIndex).toBeLessThan(bodyCloseIndex);
    });

    it("handles multiple suspended content chunks", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>Initial</div>${endMarker}<div>Suspended 1</div><div>Suspended 2</div>`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div>Initial</div>`);
      expect(result).toContain(`<div>Suspended 1</div>`);
      expect(result).toContain(`<div>Suspended 2</div>`);

      const scriptIndex = result.indexOf(`<script src="/client.js"></script>`);
      const suspended1Index = result.indexOf(`<div>Suspended 1</div>`);
      const suspended2Index = result.indexOf(`<div>Suspended 2</div>`);

      expect(scriptIndex).toBeLessThan(suspended1Index);
      expect(suspended1Index).toBeLessThan(suspended2Index);
    });

    it("handles app stream with no suspended content", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>Initial content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div>Initial content</div>`);
      expect(result).toContain(`<script src="/client.js"></script>`);
      expect(result).not.toContain(`Suspended`);
    });
  });

  describe("chunked streams", () => {
    it("handles document stream split across chunks", async () => {
      const outerHtmlChunks = [
        `<!DOCTYPE html>\n<html>\n<head>\n`,
        `  <meta charset="utf-8" />\n</head>\n<body>\n`,
        `  ${startMarker}\n  <script src="/client.js"></script>\n</body>\n</html>`,
      ];

      const innerHtml = `<div>App content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          createChunkedStream(outerHtmlChunks),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<!DOCTYPE html>`);
      expect(result).toContain(`<div>App content</div>`);
      expect(result).toContain(`<script src="/client.js"></script>`);
    });

    it("handles app stream split across chunks", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtmlChunks = [
        `<div>Initial `,
        `content</div>${endMarker}`,
        `<div>Suspended content</div>`,
      ];

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          createChunkedStream(innerHtmlChunks),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div>Initial content</div>`);
      expect(result).toContain(`<div>Suspended content</div>`);
    });

    it("handles markers split across chunks", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtmlChunks = [
        `<div>App content</div><div id="rwsdk-app-end`,
        `"></div>`,
      ];

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          createChunkedStream(innerHtmlChunks),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div>App content</div>`);
      expect(result).toContain(endMarker);
    });
  });

  describe("edge cases", () => {
    it("handles empty app stream", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = ``;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<!DOCTYPE html>`);
      expect(result).toContain(`<script src="/client.js"></script>`);
      expect(result).toContain(`</body>`);
    });

    it("handles empty outer stream", async () => {
      const outerHtml = ``;

      const innerHtml = `<div>App content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toBe(`<div>App content</div>${endMarker}`);
    });

    it("handles app stream ending before end marker", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>App content</div>`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div>App content</div>`);
      expect(result).toContain(`<script src="/client.js"></script>`);
    });

    it("handles outer stream ending before start marker", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
</head>`;

      const innerHtml = `<div>App content</div>${endMarker}`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<!DOCTYPE html>`);
      expect(result).toContain(`<meta charset="utf-8" />`);
      expect(result).toContain(`<div>App content</div>`);
    });
  });

  describe("complete flow verification", () => {
    it("correctly orders all phases: head -> shell -> script -> suspended -> close", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Test Page</title>
</head>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div>Initial content</div>${endMarker}<div>Suspended content</div>`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      const doctypeIndex = result.indexOf(`<!DOCTYPE html>`);
      const headIndex = result.indexOf(`<head>`);
      const titleIndex = result.indexOf(`<title>Test Page</title>`);
      const initialIndex = result.indexOf(`<div>Initial content</div>`);
      const scriptIndex = result.indexOf(`<script src="/client.js"></script>`);
      const suspendedIndex = result.indexOf(`<div>Suspended content</div>`);
      const bodyCloseIndex = result.indexOf(`</body>`);
      const htmlCloseIndex = result.indexOf(`</html>`);

      expect(doctypeIndex).toBeLessThan(headIndex);
      expect(headIndex).toBeLessThan(titleIndex);
      expect(titleIndex).toBeLessThan(initialIndex);
      expect(initialIndex).toBeLessThan(scriptIndex);
      expect(scriptIndex).toBeLessThan(suspendedIndex);
      expect(suspendedIndex).toBeLessThan(bodyCloseIndex);
      expect(bodyCloseIndex).toBeLessThan(htmlCloseIndex);
    });

    it("preserves content structure and markers", async () => {
      const outerHtml = `<!DOCTYPE html>
<html>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

      const innerHtml = `<div id="app">
    <h1>Hello</h1>
    <p>World</p>
  </div>${endMarker}<div>More content</div>`;

      const result = await streamToString(
        stitchDocumentAndAppStreams(
          stringToStream(outerHtml),
          stringToStream(innerHtml),
          startMarker,
          endMarker,
        ),
      );

      expect(result).toContain(`<div id="app">`);
      expect(result).toContain(`<h1>Hello</h1>`);
      expect(result).toContain(`<p>World</p>`);
      expect(result).toContain(endMarker);
      expect(result).toContain(`<div>More content</div>`);
      expect(result).not.toContain(startMarker);
    });
  });
});
