import { defineRequestState } from "rwsdk/worker";
import { Counter } from "./counter.js";

// Request-scoped counter state
export const [counter, setCounter] = defineRequestState<Counter>();
