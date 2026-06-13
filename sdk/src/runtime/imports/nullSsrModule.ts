export const createNullSsrModule = () =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        // Return undefined for promise-like properties so React does not treat
        // the placeholder module as a thenable.
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return undefined;
        }
        return () => null;
      },
    },
  );
