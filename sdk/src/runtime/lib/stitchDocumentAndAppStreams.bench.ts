import React from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { afterAll, bench } from "vitest";
import { stitchDocumentAndAppStreams } from "./stitchDocumentAndAppStreams.js";

const startMarker = '<div id="rwsdk-app-start"></div>';
const endMarker = '<div id="rwsdk-app-end"></div>';

function createDocument() {
  return React.createElement(
    "html",
    null,
    React.createElement(
      "head",
      null,
      React.createElement("meta", { charSet: "utf-8" }),
    ),
    React.createElement(
      "body",
      null,
      React.createElement(
        "div",
        { id: "hydrate-root" },
        React.createElement("div", { id: "rwsdk-app-start" }),
      ),
      React.createElement("script", null, 'console.log("hydrate")'),
    ),
  );
}

function createApp(rowCount: number, maskedValue: string) {
  const rows = Array.from({ length: rowCount }, (_, index) =>
    React.createElement(
      "tr",
      { key: index },
      React.createElement(
        "td",
        null,
        `Customer ${index + 1}: ${maskedValue} 1234`,
      ),
    ),
  );

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("title", null, "Customers"),
    React.createElement(
      "table",
      null,
      React.createElement("tbody", null, rows),
    ),
    React.createElement("div", { id: "rwsdk-app-end" }),
  );
}

async function createStitchedStream(rowCount: number, maskedValue: string) {
  const [outerHtml, innerHtml] = await Promise.all([
    renderToReadableStream(createDocument()),
    renderToReadableStream(createApp(rowCount, maskedValue)),
  ]);

  return stitchDocumentAndAppStreams(
    outerHtml,
    innerHtml,
    startMarker,
    endMarker,
  );
}

async function consume(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let chunks = 0;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    chunks++;
    html += decoder.decode(value, { stream: true });
  }

  html += decoder.decode();
  return { bytes, chunks, html };
}

async function profile(rowCount: number, maskedValue: string) {
  const startedAt = performance.now();
  const stream = await createStitchedStream(rowCount, maskedValue);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let chunks = 0;
  let html = "";
  let firstChunkAt = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (chunks === 0) firstChunkAt = performance.now();
    bytes += value.byteLength;
    chunks++;
    html += decoder.decode(value, { stream: true });
  }
  html += decoder.decode();

  return {
    rows: rowCount,
    bytes,
    chunks,
    firstChunkMs: Number((firstChunkAt - startedAt).toFixed(3)),
    totalMs: Number((performance.now() - startedAt).toFixed(3)),
    replacementCharacters: html.split("�").length - 1,
  };
}

bench(
  "stitch complete - small ASCII page",
  async () => {
    await consume(await createStitchedStream(10, "***"));
  },
  { time: 1000 },
);

bench(
  "stitch complete - 100 multibyte rows",
  async () => {
    await consume(await createStitchedStream(100, "•••"));
  },
  { time: 1000 },
);

bench(
  "stitch complete - 2000 multibyte rows",
  async () => {
    await consume(await createStitchedStream(2_000, "•••"));
  },
  { time: 1000 },
);

afterAll(async () => {
  const metrics = await Promise.all([
    profile(10, "***"),
    profile(100, "•••"),
    profile(2_000, "•••"),
  ]);
  console.log("stitchDocumentAndAppStreams metrics", JSON.stringify(metrics));
});
