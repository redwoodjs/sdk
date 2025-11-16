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
  let index = 0;

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

  it("extracts and prepends single title tag", async () => {
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

    const innerHtml = `<title>Page Title</title><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    expect(result.indexOf(`<title>Page Title</title>`)).toBeLessThan(
      result.indexOf(`<!DOCTYPE html>`),
    );
    expect(result).toContain(`<div>App content</div>`);
  });

  it("extracts and prepends multiple hoisted tags", async () => {
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

    const innerHtml = `<title>Page Title</title><meta name="description" content="Test" /><link rel="stylesheet" href="/styles.css" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    expect(result).toContain(`<meta name="description" content="Test" />`);
    expect(result).toContain(`<link rel="stylesheet" href="/styles.css" />`);
    const hoistedStart = result.indexOf(`<title>Page Title</title>`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(hoistedStart).toBeLessThan(doctypeStart);
  });

  it("handles app stream with no hoisted tags", async () => {
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

    expect(result).toContain(`<div>App content</div>`);
    expect(result).not.toContain(`<title>`);
  });

  it("handles hoisted tags split across chunks", async () => {
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

    const innerHtmlChunks = [
      `<title>Page `,
      `Title</title><meta name="description" `,
      `content="Test" /><div>App content</div>${endMarker}`,
    ];

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        createChunkedStream(innerHtmlChunks),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    expect(result).toContain(`<meta name="description" content="Test" />`);
    const hoistedStart = result.indexOf(`<title>Page Title</title>`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(hoistedStart).toBeLessThan(doctypeStart);
  });

  it("handles style tags with content", async () => {
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

    const innerHtml = `<style>body { margin: 0; }</style><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<style>body { margin: 0; }</style>`);
    const styleStart = result.indexOf(`<style>`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(styleStart).toBeLessThan(doctypeStart);
  });

  it("handles base tags", async () => {
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

    const innerHtml = `<base href="/app/" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<base href="/app/" />`);
    const baseStart = result.indexOf(`<base`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(baseStart).toBeLessThan(doctypeStart);
  });

  it("correctly stitches document and app streams with all phases", async () => {
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

    const innerHtml = `<title>Test Page</title><div>Initial content</div>${endMarker}<div>Suspended content</div>`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Test Page</title>`);
    expect(result).toContain(`<div>Initial content</div>`);
    expect(result).toContain(`<script src="/client.js"></script>`);
    expect(result).toContain(`<div>Suspended content</div>`);

    const titleIndex = result.indexOf(`<title>Test Page</title>`);
    const doctypeIndex = result.indexOf(`<!DOCTYPE html>`);
    const scriptIndex = result.indexOf(`<script src="/client.js"></script>`);
    const suspendedIndex = result.indexOf(`<div>Suspended content</div>`);

    expect(titleIndex).toBeLessThan(doctypeIndex);
    expect(scriptIndex).toBeGreaterThan(titleIndex);
    expect(suspendedIndex).toBeGreaterThan(scriptIndex);
  });

  it("handles empty app stream", async () => {
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
  });

  it("handles empty outer stream", async () => {
    const outerHtml = ``;

    const innerHtml = `<title>Page Title</title><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    expect(result).toContain(`<div>App content</div>`);
  });

  it("handles meta tags with various attributes", async () => {
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

    const innerHtml = `<meta name="viewport" content="width=device-width" /><meta property="og:title" content="Test" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(
      `<meta name="viewport" content="width=device-width" />`,
    );
    expect(result).toContain(`<meta property="og:title" content="Test" />`);
    const metaStart = result.indexOf(`<meta name="viewport"`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(metaStart).toBeLessThan(doctypeStart);
  });

  it("stops extraction at first non-hoisted tag", async () => {
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

    const innerHtml = `<title>Page Title</title><div>Should not be hoisted</div><meta name="description" content="Should not be hoisted" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    expect(result).not.toContain(
      `<meta name="description" content="Should not be hoisted" />`,
    );
    expect(result).toContain(`<div>Should not be hoisted</div>`);
  });

  it("handles link tags with various rel attributes", async () => {
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

    const innerHtml = `<link rel="stylesheet" href="/styles.css" /><link rel="preload" href="/script.js" as="script" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<link rel="stylesheet" href="/styles.css" />`);
    expect(result).toContain(
      `<link rel="preload" href="/script.js" as="script" />`,
    );
    const linkStart = result.indexOf(`<link rel="stylesheet"`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(linkStart).toBeLessThan(doctypeStart);
  });

  it("handles title tag with multiline content", async () => {
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

    const innerHtml = `<title>
  Multi-line
  Title
</title><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>`);
    expect(result).toContain(`Multi-line`);
    expect(result).toContain(`</title>`);
    const titleStart = result.indexOf(`<title>`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(titleStart).toBeLessThan(doctypeStart);
  });

  it("handles complex real-world scenario with all tag types", async () => {
    const outerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  ${startMarker}
  <script src="/client.js"></script>
</body>
</html>`;

    const innerHtml = `<title>My App</title><meta name="description" content="App description" /><link rel="stylesheet" href="/app.css" /><style>/* custom styles */</style><base href="/" /><div id="app">Content</div>${endMarker}<div>Suspended</div>`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>My App</title>`);
    expect(result).toContain(
      `<meta name="description" content="App description" />`,
    );
    expect(result).toContain(`<link rel="stylesheet" href="/app.css" />`);
    expect(result).toContain(`<style>/* custom styles */</style>`);
    expect(result).toContain(`<base href="/" />`);
    expect(result).toContain(`<div id="app">Content</div>`);
    expect(result).toContain(`<div>Suspended</div>`);

    const titleIndex = result.indexOf(`<title>My App</title>`);
    const doctypeIndex = result.indexOf(`<!DOCTYPE html>`);
    expect(titleIndex).toBeLessThan(doctypeIndex);
  });

  it("preserves order of hoisted tags", async () => {
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

    const innerHtml = `<title>First</title><meta name="second" /><link rel="third" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    const titleIndex = result.indexOf(`<title>First</title>`);
    const metaIndex = result.indexOf(`<meta name="second" />`);
    const linkIndex = result.indexOf(`<link rel="third" />`);

    expect(titleIndex).toBeLessThan(metaIndex);
    expect(metaIndex).toBeLessThan(linkIndex);
  });

  it("handles app stream ending during hoisted tag extraction", async () => {
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

    const innerHtml = `<title>Page Title</title>`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    const titleIndex = result.indexOf(`<title>Page Title</title>`);
    const doctypeIndex = result.indexOf(`<!DOCTYPE html>`);
    expect(titleIndex).toBeLessThan(doctypeIndex);
  });

  it("handles whitespace before hoisted tags", async () => {
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

    const innerHtml = `   <title>Page Title</title><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<title>Page Title</title>`);
    expect(result).toContain(`<div>App content</div>`);
  });

  it("handles self-closing meta tags", async () => {
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

    const innerHtml = `<meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<meta charset="utf-8" />`);
    expect(result).toContain(
      `<meta name="viewport" content="width=device-width" />`,
    );
    const metaStart = result.indexOf(`<meta charset="utf-8" />`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(metaStart).toBeLessThan(doctypeStart);
  });

  it("handles link tags without self-closing slash", async () => {
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

    const innerHtml = `<link rel="stylesheet" href="/styles.css"><div>App content</div>${endMarker}`;

    const result = await streamToString(
      stitchDocumentAndAppStreams(
        stringToStream(outerHtml),
        stringToStream(innerHtml),
        startMarker,
        endMarker,
      ),
    );

    expect(result).toContain(`<link rel="stylesheet" href="/styles.css">`);
    const linkStart = result.indexOf(`<link rel="stylesheet"`);
    const doctypeStart = result.indexOf(`<!DOCTYPE html>`);
    expect(linkStart).toBeLessThan(doctypeStart);
  });
});
