import { RequestInfo } from "rwsdk/worker";
import { ServerFunctionsDemo } from "./server-functions";

export function HomePage({ ctx }: RequestInfo) {
  return (
    <div>
      <h2>Server Functions Demo</h2>
      <p>This playground demonstrates server functions (serverQuery and serverAction).</p>
      <ServerFunctionsDemo />
    </div>
  );
}
