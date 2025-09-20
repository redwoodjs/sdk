import { TestComponent } from "../components/TestComponent.js";
import { ClientTestComponent } from "../components/ClientTestComponent.js";

export default function RenderToStreamPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>renderToStream API Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This page tests the `renderToStream` API with various component types.
        The page should render correctly and maintain consistent behavior.
      </p>

      <div data-testid="render-stream-content">
        <TestComponent
          title="Server Component via renderToStream"
          type="server"
        />
        <ClientTestComponent title="Client Component via renderToStream" />

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
            ✓ This page was rendered using the renderToStream API and should
            display correctly with proper streaming behavior and component
            hydration.
          </p>
        </div>
      </div>
    </div>
  );
}
