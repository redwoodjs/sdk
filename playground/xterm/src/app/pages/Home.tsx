import { Terminal } from "@/app/components/Terminal";
import { Suspense } from "react";
import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Xterm example</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Terminal />
      </Suspense>
    </div>
  );
}
