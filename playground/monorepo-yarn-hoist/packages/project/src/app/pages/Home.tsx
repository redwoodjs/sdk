import { RequestInfo } from "rwsdk/worker";
import { Button } from "ui-lib";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello from the Home Page!</h1>
      <p>The time is {ctx.now.toISOString()}</p>
      <Button />
    </div>
  );
}
