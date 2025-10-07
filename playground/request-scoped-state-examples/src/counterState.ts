import { defineRequestState } from "rwsdk/requestState";
import { Counter } from "./counter.js";

// Request-scoped counter state
export const [counter, setCounter] = defineRequestState<Counter>();

export const initializeCounter = (requestId: string) => {
  const counterInstance = new Counter(requestId);
  setCounter(counterInstance);
  return counterInstance;
};
