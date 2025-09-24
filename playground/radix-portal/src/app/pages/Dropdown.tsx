import type { RequestInfo } from "rwsdk/worker";
import { CounterButton } from "../components/CounterButton.js";
import { DropdownComponent } from "../components/DropdownComponent.js";
import { myAction } from "../actions.js";

export function Dropdown() {
  return (
    <form>
      <div>
        <h1>Dropdown Test</h1>
        <DropdownComponent />
        <CounterButton />
        <button onClick={myAction}>Trigger Action</button>
      </div>
    </form>
  );
}
