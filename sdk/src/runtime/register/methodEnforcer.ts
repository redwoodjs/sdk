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
  allowedOrigins?: readonly string[];
}

// context(justinvdm, 2026-04-20): Origin validation for non-GET action requests.
// Method enforcement alone does not distinguish a legitimate same-origin POST
// from a POST driven by a same-site sibling origin (e.g. sibling subdomain,
// another localhost port). SameSite=Lax cookies are attached in both cases, and
// the action request's Content-Type is CORS-safelisted, so no preflight fires.
// We require the request's Origin header to match the app's own origin, unless
// the caller origin is listed in allowedOrigins.
function validateSameOrigin(
  req: Request,
  allowedOrigins: readonly string[] | undefined,
): { valid: true } | { valid: false; response: Response } {
  const origin = req.headers.get("Origin");

  if (!origin) {
    return {
      valid: false,
      response: new Response("Missing Origin header", { status: 403 }),
    };
  }

  const selfOrigin = new URL(req.url).origin;

  if (origin === selfOrigin) {
    return { valid: true };
  }

  if (allowedOrigins && allowedOrigins.includes(origin)) {
    return { valid: true };
  }

  return {
    valid: false,
    response: new Response("Origin not allowed", { status: 403 }),
  };
}

export async function rscActionHandler(
  req: Request,
  { getServerModuleExport, decodeReply, allowedOrigins }: RscActionHandlerDeps,
): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  // context(justinvdm, 2026-04-20): Enforce Origin/Host match for non-GET action
  // requests. GET (serverQuery) is expected to be idempotent and is not subject
  // to this check.
  if (req.method !== "GET") {
    const originCheck = validateSameOrigin(req, allowedOrigins);
    if (!originCheck.valid) {
      return originCheck.response;
    }
  }

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
