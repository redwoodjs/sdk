import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1 style={{ fontWeight: 400 }}>Hello World (400)</h1>
      <h2 style={{ fontWeight: 500 }}>Hello World (500)</h2>
      <h3 style={{ fontWeight: 600 }}>Hello World (600)</h3>
      <p>
        This example demonstrates the font URL issue when importing fonts via
        CSS @import statements. The fonts are imported in styles.css, but may
        fail to load in production if they are not bundled correctly.
      </p>
    </div>
  );
}
