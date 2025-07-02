import { RequestInfo } from "rwsdk/worker";
import { IncrementButton } from "./IncrementButton";

import { COUNT } from "./functions";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World {COUNT}</h1>

      <IncrementButton />

      <a href="/about">About</a>
    </div>
  );
}
