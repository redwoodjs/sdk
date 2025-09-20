import { defineApp } from "rwsdk/worker";
import { renderToStream, renderToString } from "rwsdk/react-server-components";

import { Document } from "@/app/Document";
import RenderToStreamPage from "@/app/pages/RenderToStreamPage";
import RenderToStringPage from "@/app/pages/RenderToStringPage";
import { setCommonHeaders } from "@/app/headers";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  async ({ request }) => {
    const url = new URL(request.url);

    // Home page with navigation
    if (url.pathname === "/") {
      const homeContent = (
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h1 style={{ marginBottom: "2rem" }}>Render APIs Test Playground</h1>
          <p style={{ marginBottom: "2rem", color: "#666" }}>
            This playground tests the `renderToStream` and `renderToString` APIs
            to ensure they work correctly.
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
              <small>
                Tests the renderToStream API with streaming behavior
              </small>
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

      const stream = await renderToStream(homeContent, {
        Document,
        injectRSCPayload: true,
        onError: (error) => console.error("Render error:", error),
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // renderToStream test page
    if (url.pathname === "/render-to-stream") {
      const stream = await renderToStream(<RenderToStreamPage />, {
        Document,
        injectRSCPayload: true,
        onError: (error) => console.error("Render error:", error),
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // renderToString test page
    if (url.pathname === "/render-to-string") {
      const html = await renderToString(<RenderToStringPage />, {
        Document,
        injectRSCPayload: true,
        onError: (error) => console.error("Render error:", error),
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 404 page
    const notFoundContent = (
      <div
        style={{
          padding: "2rem",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#f44336" }}>404 - Page Not Found</h1>
        <p>The requested page could not be found.</p>
        <a href="/" style={{ color: "#2196F3" }}>
          ← Back to Home
        </a>
      </div>
    );

    const stream = await renderToStream(notFoundContent, {
      Document,
      onError: (error) => console.error("Render error:", error),
    });

    return new Response(stream, {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  },
]);
