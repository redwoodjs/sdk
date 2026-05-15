import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return <div>Hello from Base Path</div>;
}
