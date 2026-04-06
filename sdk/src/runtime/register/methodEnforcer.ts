// context(justinvdm, 2026-04-06): Extracted from rscActionHandler() for testability.
// The real getServerModuleExport and decodeReply require the react-server environment
// (virtual module lookup, react-server-dom-webpack), so we accept them as injected
// dependencies. worker.ts passes the real implementations; tests pass fakes.

type GetServerModuleExport = (actionId: string) => Promise<unknown>;

type DecodeReply = (
  data: string | FormData,
  moduleMap: null,
) => Promise<unknown>;

export interface RscActionHandlerDeps {
  getServerModuleExport: GetServerModuleExport;
  decodeReply: DecodeReply;
}

export async function rscActionHandler(
  req: Request,
  { getServerModuleExport, decodeReply }: RscActionHandlerDeps,
): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  let args: unknown[] = [];

  if (req.method === "GET") {
    const argsParam = url.searchParams.get("args");
    if (argsParam) {
      args = JSON.parse(argsParam);
    }
  } else {
    const data = contentType?.startsWith("multipart/form-data")
      ? await req.formData()
      : await req.text();

    args = (await decodeReply(data, null)) as unknown[];
  }

  const actionId = url.searchParams.get("__rsc_action_id");

  if (import.meta.env.VITE_IS_DEV_SERVER && actionId === "__rsc_hot_update") {
    return null;
  }

  const action = await getServerModuleExport(actionId!);

  if (typeof action !== "function") {
    throw new Error(`Action ${actionId} is not a function`);
  }

  // context(justinvdm, 2026-04-06): Validate the declared HTTP method before
  // invocation. serverAction() attaches .method = "POST" at creation time via
  // createServerFunction(), serverQuery() attaches "GET". Functions without
  // .method default to POST to match serverAction() semantics.
  const actionMethod = (action as Function & { method?: string }).method ?? "POST";

  if (actionMethod !== req.method) {
    return new Response(
      `Method ${req.method} is not allowed for this action. Allowed: ${actionMethod}.`,
      {
        status: 405,
        headers: { Allow: actionMethod },
      },
    );
  }

  return action(...args);
}
