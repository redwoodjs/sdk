import { RequestInfo } from "rwsdk/worker";

export function About({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>About</h1>

      <a href="/">Home</a>
    </div>
  );
}
