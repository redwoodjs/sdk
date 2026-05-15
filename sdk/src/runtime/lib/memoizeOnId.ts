export const memoizeOnId = <Result>(fn: (id: string) => Result) => {
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const results: Record<string, Result> = {};

  const memoizedFn = (id: string) => {
    if (hasOwnProperty.call(results, id)) {
      return results[id];
    }
    return (results[id] = fn(id));
  };

  return memoizedFn;
};
