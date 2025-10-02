import { Terminal } from "@/app/components/Terminal";
import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Xterm example</h1>
      <Terminal />
    </div>
  );
}
