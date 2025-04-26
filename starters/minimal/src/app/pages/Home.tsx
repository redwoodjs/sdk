import { RequestInfo } from "@redwoodjs/sdk/worker";
import { ClientCounter } from "./client";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World</h1>
      <ClientCounter />
    </div>
  );
}
