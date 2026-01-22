/**
 * Handles test requests from the test runner bridge.
 * 
 * @param request The incoming request
 * @param actions A map of action names to action functions
 */
export async function handleTestRequest(request: Request, actions: Record<string, Function>) {
  // Security Guard: Strictly block execution in non-test environments
  // Note: We rely on the user to ensure this is only callable in test/dev
  // via their own route definitions, but this adds an extra layer if 
  // they pass `import.meta.env.PROD`.
  
  // We don't have access to import.meta.env inside the library in the same way,
  // so we rely on the implementation pattern or an explicit argument if we want to enforce it here.
  // For now, mirroring the guide implementation which assumes the route itself is guarded.
  
  const { name, args } = (await request.json()) as {
    name: string;
    args: any[];
  };

  const actionArgs = args.map((arg) => {
    // Deserialize FormData if needed
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
