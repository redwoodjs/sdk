import { SELF } from "cloudflare:test";

export async function invoke<T>(actionName: string, ...args: any[]): Promise<T> {
  const serializedArgs = args.map(arg => {
    if (arg instanceof FormData) {
      return { __type: "FormData", entries: Array.from(arg.entries()) };
    }
    return arg;
  });

  const response = await SELF.fetch("http://localhost/_test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: actionName, args: serializedArgs }),
  });

  if (!response.ok) {
    const data = await response.json() as { error: string, stack?: string };
    const err = new Error(data.error);
    err.stack = data.stack; // Preserve the stack trace from the worker
    throw err;
  }

  const data = await response.json() as { result: T };
  return data.result;
}
