import { ComponentA } from "../components/ComponentA";

export function MissingLinkPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Missing Link Directive Scan Test</h1>
      <p>This page demonstrates the directive scan stale map issue.</p>

      <div style={{ margin: "2rem 0" }}>
        <h2>Initial State</h2>
        <p>
          ComponentA is initially a server component and doesn't import any
          client components.
        </p>
        <ComponentA />
      </div>

      <div
        style={{
          margin: "2rem 0",
          padding: "1rem",
          backgroundColor: "#f0f0f0",
          borderRadius: "8px",
        }}
      >
        <h3>Test Instructions:</h3>
        <ol>
          <li>Start the dev server - should work fine initially</li>
          <li>Visit this page - should render ComponentA (server component)</li>
          <li>
            Modify <code>ComponentA.tsx</code> to uncomment the{" "}
            <code>&lt;ComponentB /&gt;</code> line
          </li>
          <li>
            Refresh the page - should now show ComponentB and ComponentC without
            SSR errors
          </li>
        </ol>

        <p>
          <strong>Expected Behavior:</strong>
        </p>
        <p>
          With the fix, the pre-scan should have already discovered{" "}
          <code>ComponentB.tsx</code> and <code>ComponentC.tsx</code> during
          startup, so when <code>ComponentA</code> imports{" "}
          <code>ComponentB</code>, there should be no SSR errors.
        </p>

        <p>
          <strong>Without the fix, you would see:</strong>
        </p>
        <pre
          style={{
            backgroundColor: "#fff",
            padding: "1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          Internal server error: (ssr) No module found for
          '/src/components/ComponentB.tsx' in module lookup for "use client"
          directive
        </pre>
      </div>
    </div>
  );
}
