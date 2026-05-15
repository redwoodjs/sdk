import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import ServerOnlyPage from "@/app/pages/ServerOnlyPage";
import ClientOnlyPage from "@/app/pages/ClientOnlyPage";
import MixedPage from "@/app/pages/MixedPage";
import { setCommonHeaders } from "@/app/headers";

function HomePage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "2rem" }}>useId Test Playground</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        This playground tests `React.useId()` behavior across different
        component types and hydration scenarios.
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
          href="/server-only"
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
          <strong>Server-Only Components</strong>
          <br />
          <small>Tests useId in server components only (no hydration)</small>
        </a>

        <a
          href="/client-only"
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
          <strong>Client-Only Components</strong>
          <br />
          <small>Tests useId in a fully client-side page</small>
        </a>

        <a
          href="/mixed"
          style={{
            padding: "1rem",
            border: "2px solid #FF9800",
            borderRadius: "4px",
            textDecoration: "none",
            color: "#FF9800",
            backgroundColor: "#f8f9fa",
            display: "block",
          }}
        >
          <strong>Mixed Server/Client Components</strong>
          <br />
          <small>
            Tests useId in both server and client components on the same page
          </small>
        </a>
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
  render(Document, [
    route("/", HomePage),
    route("/server-only", ServerOnlyPage),
    route("/client-only", ClientOnlyPage),
    route("/mixed", MixedPage),
  ]),
]);
