import { RequestInfo } from "rwsdk/worker";
import { ComponentA } from "../components/ComponentA.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <>
      <div>Hello World</div>
      <ComponentA />
    </>
  );
}
