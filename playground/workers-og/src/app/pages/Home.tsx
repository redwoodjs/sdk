import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>WASM Test</h1>
      <p>Visit <a href="/og">/og</a> to test WASM image generation</p>
    </div>
  );
}
