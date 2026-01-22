export async function invoke<T>(actionName: string, ...args: any[]): Promise<T> {
  // @ts-ignore
  const { SELF } = await import("cloudflare:test");
  const serializedArgs = args.map(arg => {
    // Handle special types like FormData if needed
    if (arg instanceof FormData) {
      return { __type: "FormData", entries: Array.from(arg.entries()) };
    }
    return arg;
  });

  // Call the bridge route
  const response = await SELF.fetch("http://localhost/_test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: actionName, args: serializedArgs }),
  });

  if (!response.ok) {
    const data = await response.json() as { error: string, stack?: string };
    const err = new Error(data.error);
    err.stack = data.stack;
    throw err;
  }

  const data = await response.json() as { result: T };
  return data.result;
}
