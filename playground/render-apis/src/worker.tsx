import { defineApp, renderToStream, renderToString } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";

function HomePage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "2rem" }}>Render APIs Test Playground</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        This playground tests the `renderToStream` and `renderToString` APIs.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: "600px",
        }}
      >
        <a
          href="/render-to-stream"
          style={{
            padding: "1rem",
            border: "2px solid #4CAF50",
            borderRadius: "4px",
            textDecoration: "none",
            color: "#4CAF50",
            backgroundColor: "#f8f9fa",
            display: "block",
          }}
        >
          <strong>renderToStream API Test</strong>
          <br />
          <small>Tests the renderToStream API with streaming behavior</small>
        </a>

        <a
          href="/render-to-string"
          style={{
            padding: "1rem",
            border: "2px solid #2196F3",
            borderRadius: "4px",
            textDecoration: "none",
            color: "#2196F3",
            backgroundColor: "#f8f9fa",
            display: "block",
          }}
        >
          <strong>renderToString API Test</strong>
          <br />
          <small>Tests the renderToString API with string output</small>
        </a>
      </div>
    </div>
  );
}

function RenderToStreamTestPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>renderToStream API Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This page tests the `renderToStream` API with basic content.
      </p>

      <div data-testid="render-stream-content">
        <div
          style={{
            padding: "1rem",
            border: "2px solid #4CAF50",
            borderRadius: "4px",
            marginBottom: "1rem",
            backgroundColor: "#f8f9fa",
          }}
        >
          <h2 style={{ margin: "0 0 0.5rem 0", color: "#4CAF50" }}>
            Server Component
          </h2>
          <p style={{ margin: 0 }}>
            This content was rendered using renderToStream API.
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            backgroundColor: "#e8f5e8",
            borderRadius: "4px",
            marginTop: "2rem",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#2e7d32" }}>
            renderToStream Test Status
          </h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#2e7d32" }}>
            ✓ This page was rendered using the renderToStream API.
          </p>
        </div>
      </div>
    </div>
  );
}

function RenderToStringTestPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>renderToString API Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This page tests the `renderToString` API with basic content.
      </p>

      <div data-testid="render-string-content">
        <div
          style={{
            padding: "1rem",
            border: "2px solid #2196F3",
            borderRadius: "4px",
            marginBottom: "1rem",
            backgroundColor: "#f8f9fa",
          }}
        >
          <h2 style={{ margin: "0 0 0.5rem 0", color: "#2196F3" }}>
            Server Component
          </h2>
          <p style={{ margin: 0 }}>
            This content was rendered using renderToString API.
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            marginTop: "2rem",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#1565c0" }}>
            renderToString Test Status
          </h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#1565c0" }}>
            ✓ This page was rendered using the renderToString API.
          </p>
        </div>
      </div>
    </div>
  );
}

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", HomePage)]),
  // Test renderToStream API directly
  route("/render-to-stream", async () => {
    const stream = await renderToStream(<RenderToStreamTestPage />, {
      Document,
      injectRSCPayload: true,
      onError: (error) => console.error("Render error:", error),
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/html" },
    });
  }),
  // Test renderToString API directly
  route("/render-to-string", async () => {
    const html = await renderToString(<RenderToStringTestPage />, {
      Document,
      injectRSCPayload: true,
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }),
]);
