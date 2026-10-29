// context(justinvdm, 2026-04-06): Extracted from rscActionHandler() for testability.
// The real getServerModuleExport and decodeReply require the react-server environment
// (virtual module lookup, react-server-dom-webpack), so we accept them as injected
// dependencies. worker.ts passes the real implementations; tests pass fakes.

type GetServerModuleExport = (actionId: string) => Promise<unknown>;

type DecodeReply = (
  data: string | FormData,
  moduleMap: null,
) => Promise<unknown>;

type DecodeAction = (
  data: FormData,
  serverManifest: unknown,
) => Promise<(() => Promise<unknown>) | null>;

export type NativeFormAction = {
  formData: FormData;
};

export interface RscActionHandlerDeps {
  getServerModuleExport: GetServerModuleExport;
  decodeReply: DecodeReply;
  decodeAction?: DecodeAction;
  serverManifest?: unknown;
  allowedOrigins?: readonly string[];
}

export async function getNativeFormAction(
  req: Request,
): Promise<NativeFormAction | undefined> {
  if (req.method !== "POST") {
    return undefined;
  }

  const contentType = req.headers.get("content-type");
  if (
    !contentType?.startsWith("multipart/form-data") &&
    !contentType?.startsWith("application/x-www-form-urlencoded")
  ) {
    return undefined;
  }

  try {
    // context(chrsnym, 2026-10-28): React adds one of these fields when a
    // server function is used as a form action. Read a clone so an ordinary
    // route can still read the original request body when neither field exists.
    const formData = await req.clone().formData();
    for (const key of formData.keys()) {
      if (key.startsWith("$ACTION_ID_") || key.startsWith("$ACTION_REF_")) {
        return { formData };
      }
    }
  } catch {
    // context(chrsnym, 2026-10-28): Leave malformed ordinary form bodies to
    // the matched route. Classification must not consume the request or replace
    // the route's own error handling.
  }

  return undefined;
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

function enforceActionMethod(
  action: Function,
  requestMethod: string,
): Response | undefined {
  const actionMethod =
    (action as Function & { method?: string }).method ?? "POST";

  if (actionMethod !== requestMethod) {
    return new Response(
      `Method ${requestMethod} is not allowed for this action. Allowed: ${actionMethod}.`,
      {
        status: 405,
        headers: { Allow: actionMethod },
      },
    );
  }

  return undefined;
}

function getDirectActionId(formData: FormData): string | undefined {
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_ID_")) {
      return key.slice("$ACTION_ID_".length);
    }
  }

  return undefined;
}

export async function rscActionHandler(
  req: Request,
  deps: RscActionHandlerDeps,
  nativeFormAction?: NativeFormAction,
): Promise<unknown> {
  const {
    getServerModuleExport,
    decodeReply,
    decodeAction,
    serverManifest,
    allowedOrigins,
  } = deps;
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

  if (nativeFormAction) {
    if (!decodeAction || !serverManifest) {
      throw new Error(
        "Native form actions require decodeAction and serverManifest",
      );
    }

    const action = await decodeAction(
      nativeFormAction.formData,
      serverManifest,
    );
    if (!action) {
      return undefined;
    }

    // context(chrsnym, 2026-10-28): React binds the submitted FormData to the
    // decoded function. A bound function does not reliably retain RedwoodSDK's
    // method property, so use the original export for direct action identifiers
    // when one is available.
    const directActionId = getDirectActionId(nativeFormAction.formData);
    const methodSource = directActionId
      ? await getServerModuleExport(directActionId)
      : action;

    if (typeof methodSource !== "function") {
      throw new Error(`Action ${directActionId} is not a function`);
    }

    const methodError = enforceActionMethod(methodSource, req.method);
    if (methodError) {
      return methodError;
    }

    return action();
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
  const methodError = enforceActionMethod(action, req.method);
  if (methodError) {
    return methodError;
  }

  return action(...args);
}
