import { RequestInfo } from "rwsdk/worker";
import { Button } from "ui-lib";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>SSR Client Component from Package</h1>
      <p>
        This button is a client component imported from a local package. It
        should be interactive.
      </p>
      <Button>Click Me</Button>
    </div>
  );
}
