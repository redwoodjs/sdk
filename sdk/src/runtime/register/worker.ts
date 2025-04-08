import {
  registerServerReference as baseRegisterServerReference,
  registerClientReference as baseRegisterClientReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";
import { getModuleExport } from "../imports/worker";
import { IS_DEV } from "../constants";

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  if (typeof action !== "function") {
    return action;
  }

  return baseRegisterServerReference(action, id, name);
}

export function registerClientReference<Target extends Record<string, any>>(
  id: string,
  exportName: string,
  target: Target,
) {
  const reference = baseRegisterClientReference({}, id, exportName);
  return Object.defineProperties(target, {
    ...Object.getOwnPropertyDescriptors(reference),
    $$async: { value: true },
    $$isClientReference: { value: true },
  });
}

export async function rscActionHandler(req: Request): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  const data = contentType?.startsWith("multipart/form-data")
    ? await req.formData()
    : await req.text();

  const args = (await decodeReply(data, null)) as unknown[];
  const actionId = url.searchParams.get("__rsc_action_id");

  if (IS_DEV && actionId === "__rsc_hot_update") {
    return null;
  }
  const action = await getModuleExport(actionId!);

  if (typeof action !== "function") {
    throw new Error(`Action ${actionId} is not a function`);
  }

  return action(...args);
}
