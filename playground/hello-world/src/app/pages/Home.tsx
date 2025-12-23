import { RequestInfo } from "rwsdk/worker";
import { Button } from "./Button.client";
import { ErrorDemo } from "./ErrorDemo";
import { Stars } from "./Stars.client";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World</h1>
      <p>This playground demonstrates error handling with React 19 APIs.</p>
      <p>
        Open the browser console and click the buttons below to see error
        handling in action.
      </p>
      <Button />
      <Stars level={5} />
      <ErrorDemo />
    </div>
  );
}
