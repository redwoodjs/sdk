const isPromiseLikeProperty = (prop: string | symbol) =>
  prop === "then" || prop === "catch" || prop === "finally";

const createNullRenderer = () => () => null;

export const createNullSsrModule = () =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        // Return undefined for promise-like properties so React does not treat
        // the placeholder module as a thenable.
        if (isPromiseLikeProperty(prop)) {
          return undefined;
        }
        return createNullRenderer();
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (isPromiseLikeProperty(prop)) {
          return undefined;
        }

        return {
          configurable: true,
          enumerable: true,
          value: createNullRenderer(),
        };
      },
    },
  );
