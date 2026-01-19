import { RequestInfo } from "rwsdk/worker";
import { Button } from "./Button.client";
import { ErrorDemo } from "./ErrorDemo";
import { Stars } from "./Stars.client";

import { ServerFunctionsDemo } from "./ServerFunctionsDemo.client";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World</h1>
      <p>This playground demonstrates error handling and server functions.</p>
      <p>
        Open the browser console and click the buttons below to see error
        handling and server functions in action.
      </p>
      <Button />
      <Stars level={5} />
      <ErrorDemo />
      <ServerFunctionsDemo />
    </div>
  );
}
