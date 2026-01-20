export async function handleTestRequest(request: Request, actions: Record<string, Function>) {
  // Security Guard: Strictly block execution in non-test environments
  // Note: Cloudflare Workers environment might use different ways to detect test env, 
  // but we'll stick to the recommended pattern or check for specific headers/vars if needed.
  // For Vitest Cloudflare Pool, it usually sets NODE_ENV or we can check a custom var.
  
  const { name, args } = (await request.json()) as {
    name: string;
    args: any[];
  };

  const actionArgs = args.map((arg) => {
    if (arg && typeof arg === "object" && arg.__type === "FormData") {
      const fd = new FormData();
      (arg.entries as [string, string][]).forEach(([k, v]) => fd.append(k, v));
      return fd;
    }
    return arg;
  });

  const action = actions[name];

  if (!action) {
    return Response.json({ error: `Action ${name} not found` }, { status: 404 });
  }

  try {
    const result = await action(...actionArgs);
    return Response.json({ result });
  } catch (e: any) {
    // Return original error and stack trace so Vitest identifies the line of failure
    return Response.json({ 
      error: e.message, 
      stack: e.stack 
    }, { status: 500 });
  }
}
