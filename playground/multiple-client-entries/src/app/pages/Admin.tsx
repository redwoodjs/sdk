import type { RequestInfo } from "rwsdk";
import { Counter } from "../components/Counter";

export function Admin({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Admin Page</h1>
      <p>This page uses a different client entry point.</p>
      <Counter initialCount={100} />
    </div>
  );
}
