import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return <div className="test-class">LightningCSS Test Page</div>;
}
