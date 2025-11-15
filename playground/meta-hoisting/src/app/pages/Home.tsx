import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <>
      <title>Hoisted Title</title>
      <meta name="description" content="This is a hoisted description." />
      <div>Hello World</div>
    </>
  );
}
