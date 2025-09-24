import type { RequestInfo } from "rwsdk/worker";
import { PortalComponent } from "../components/PortalComponent.js";
import { CounterButton } from "../components/CounterButton.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello from the Home Page!</h1>
      <PortalComponent />
      <CounterButton />
    </div>
  );
}
