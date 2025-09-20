import { TestComponent } from "../components/TestComponent.js";
import { ClientTestComponent } from "../components/ClientTestComponent.js";

export default function RenderToStringPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>renderToString API Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This page tests the `renderToString` API with various component types.
        The page should render correctly as a complete HTML string.
      </p>

      <div data-testid="render-string-content">
        <TestComponent
          title="Server Component via renderToString"
          type="server"
        />
        <ClientTestComponent title="Client Component via renderToString" />

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
            ✓ This page was rendered using the renderToString API and should
            display correctly as a complete HTML string with proper component
            hydration.
          </p>
        </div>
      </div>
    </div>
  );
}
