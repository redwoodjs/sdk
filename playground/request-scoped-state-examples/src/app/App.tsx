import { CounterDemo } from "../CounterDemo.js";
import { CounterServer } from "../CounterServer.js";

export function App() {
  return (
    <div>
      <CounterServer />
      <hr style={{ margin: "40px 0" }} />
      <CounterDemo />
    </div>
  );
}
