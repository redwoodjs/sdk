import { RequestInfo } from "rwsdk/worker";
import { Button } from "./Button.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World</h1>
      <Button />
    </div>
  );
}
