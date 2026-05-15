import { RequestInfo } from "rwsdk/worker";
import { ServerFunctionsDemo } from "./ServerFunctionsDemo.client";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Server Functions Demo</h1>
      <p>This playground demonstrates server functions (serverQuery and serverAction).</p>
      <ServerFunctionsDemo />
    </div>
  );
}
