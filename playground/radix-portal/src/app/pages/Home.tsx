import type { RequestInfo } from "rwsdk/worker";
import { CounterButton } from "../components/CounterButton.js";
import { DropdownComponent } from "../components/DropdownComponent.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello from the Home Page!</h1>
      <DropdownComponent />
      <CounterButton />
    </div>
  );
}
