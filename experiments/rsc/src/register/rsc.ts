import {
  registerServerReference as baseRegisterServerReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";

const actions = new Map<string, Function>();

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  if (typeof action !== "function") {
    return action;
  }

  actions.set(id, action);
  return baseRegisterServerReference(action, id, name);
}

export async function rscActionHandler(req: Request): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  const data = contentType?.startsWith("multipart/form-data")
    ? await req.formData()
    : await req.text();

  const args = (await decodeReply(data, null)) as unknown[];
  const actionId = url.searchParams.get("__rsc_action_id");

  if (!actionId) {
    throw new Error('"__rsc_action_id" is undefined.');
  }

  if (!actions.has(actionId)) {
    throw new Error(`Action ${actionId} not found`);
  }

  const action = actions.get(actionId);

  if (typeof action !== "function") {
    throw new Error(`Action ${actionId} is not a function`);
  }

  return action(...args);
}
