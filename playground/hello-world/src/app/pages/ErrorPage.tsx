import { RequestInfo } from "rwsdk/worker";

export function ErrorPage({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Error Page</h1>
      <p>An error occurred. Please check the console for details.</p>
    </div>
  );
}

