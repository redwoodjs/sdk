import { requestInfo } from "../requestInfo/worker.js";

/**
 * Creates a request-scoped state variable that automatically resolves to the correct
 * instance based on the current request context using AsyncLocalStorage.
 *
 * @returns A tuple containing [getter, setter] functions
 */
export function defineRequestState<T>(): [
  () => T | undefined,
  (value: T) => void,
] {
  // Generate a unique key for this state variable to prevent collisions
  const key = `__requestState_${crypto.randomUUID()}`;

  const getter = (): T | undefined => {
    const userContext = requestInfo.__userContext;
    return userContext?.[key] as T | undefined;
  };

  const setter = (value: T): void => {
    requestInfo.__userContext![key] = value;
  };

  return [getter, setter];
}
