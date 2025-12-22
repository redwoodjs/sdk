import { RequestInfo } from "rwsdk/worker";
import { ErrorDemo } from "./ErrorDemo";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World</h1>
      <p>This playground demonstrates error handling with React 19 APIs.</p>
      <p>
        Open the browser console and click the buttons below to see error
        handling in action.
      </p>
      <ErrorDemo />
    </div>
  );
}
