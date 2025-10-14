import type { RequestInfo } from "rwsdk/worker";
// import { ClientComponent } from "../../components/ClientComponent";
// import { ServerComponent } from "../../components/ServerComponent";

let counter = 0;

export function Home({ ctx, request }: RequestInfo) {
  counter++;
  const url = new URL(request.url);

  return (
    <div>
      <h1>Request Info</h1>
      <p>URL: {url.pathname}</p>
      <p>Render count: {counter}</p>
      {/* <ClientComponent /> */}
      {/* <ServerComponent /> */}
    </div>
  );
}
