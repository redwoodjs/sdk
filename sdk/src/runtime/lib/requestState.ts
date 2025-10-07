import { requestInfo } from "../requestInfo/worker.js";

let stateCounter = 0;

/**
 * Creates a request-scoped state variable that automatically resolves to the correct
 * instance based on the current request context using AsyncLocalStorage.
 *
 * @returns A tuple containing [proxy object, setter function]
 */
export function defineRequestState<T>(): [T, (value: T) => void] {
  // Generate a unique key for this state variable to prevent collisions
  const key = `__requestState_${stateCounter++}`;

  const setter = (value: T): void => {
    requestInfo.__userContext![key] = value;
  };

  // Create a proxy that delegates all property access to the stored instance
  const proxy = new Proxy({} as object, {
    get(target, prop, receiver) {
      const userContext = requestInfo.__userContext;
      const instance = userContext?.[key] as T | undefined;

      if (!instance) {
        throw new Error(
          `Request-scoped state not initialized. Make sure to call setter before accessing properties.`,
        );
      }

      const value = instance[prop as keyof T];
      if (typeof value === "function") {
        return value.bind(instance);
      }
      return value;
    },

    set(target, prop, value) {
      const userContext = requestInfo.__userContext;
      const instance = userContext?.[key] as T | undefined;

      if (!instance) {
        throw new Error(
          `Request-scoped state not initialized. Make sure to call setter before setting properties.`,
        );
      }

      (instance as any)[prop] = value;
      return true;
    },
  });

  return [proxy as T, setter];
}
