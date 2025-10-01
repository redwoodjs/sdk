import { RequestInfo } from "rwsdk/worker";
import { Counter } from "../components/Counter";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Home Page</h1>
      <Counter initialCount={0} />
    </div>
  );
}
