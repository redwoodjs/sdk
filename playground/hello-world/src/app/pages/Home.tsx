import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return <div>Hello World</div>;
}
