import type { RequestInfo } from "rwsdk/worker";
//import { ClientComponent } from "../../components/ClientComponent";
//import { ServerComponent } from "../../components/ServerComponent";

export function Home({ ctx, request }: RequestInfo) {
  const url = new URL(request.url);

  return (
    <div>
      <h1>Request Info</h1>
      <p>URL: {url.pathname}</p>
      {/* <ClientComponent /> */}
      {/* <ServerComponent /> */}
    </div>
  );
}
