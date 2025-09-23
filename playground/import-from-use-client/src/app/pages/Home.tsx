import { RequestInfo } from "rwsdk/worker";
import { ClientButton, clientObject } from "../lib/client-utils";
//import { PackageButton, packageObject } from "ui-lib";

export function Home({ ctx }: RequestInfo) {
  const localMessage = clientObject.format("World");
  //const packageMessage = packageObject.format("World");

  return (
    <div>
      <h1>SSR Client Exports</h1>
      <h2>From App Module:</h2>
      <p data-testid="local-message">{localMessage}</p>
      <ClientButton />

      <hr />

      {/*
      <h2>From Package Module:</h2>
      <p data-testid="package-message">{packageMessage}</p>
      <PackageButton />
      */}
    </div>
  );
}
