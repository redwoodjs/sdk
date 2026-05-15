import { RequestInfo } from "rwsdk/worker";
import { Interactive } from "../components/Interactive";

export function Home({ ctx }: RequestInfo) {
  return (
    <>
      <h1 data-testid="h1">RSC Kitchen Sink</h1>
      <p>
        This page demonstrates various features of React Server Components in
        RedwoodSDK.
      </p>
      <Interactive />
    </>
  );
}
