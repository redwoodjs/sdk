import { RequestInfo } from "rwsdk/worker";

export function Success({ ctx, request }: RequestInfo) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "unknown";
  const name = url.searchParams.get("name");

  return (
    <div>
      <h1>Success!</h1>
      <p>Redirected from: {from}</p>
      {name && <p>Name submitted: {name}</p>}
      <a href="/">Go back home</a>
    </div>
  );
}

