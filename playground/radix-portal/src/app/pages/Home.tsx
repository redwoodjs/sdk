import type { RequestInfo } from "rwsdk/worker";
import { CounterButton } from "../components/CounterButton.js";
import { DropdownComponent } from "../components/DropdownComponent.js";
import { myAction } from "../actions.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <form>
      <div>
        <h1>Hello from the Home Page!</h1>
        <DropdownComponent />
        <CounterButton />
        <button onClick={myAction}>Trigger Action</button>
      </div>
    </form>
  );
}
