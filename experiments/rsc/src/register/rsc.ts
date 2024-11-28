import {
  registerServerReference as baseRegisterServerReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";

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

export async function rscActionHandler(req: Request) {
  const url = new URL(req.url);
  const body = await req.text();
  const args = (await decodeReply(body, null)) as unknown[];

  const actionId = url.searchParams.get("__rsc_action_id");
  if (!actionId) {
    throw new Error('"__rsc_action_id" is undefined.');
  }

  const [file, name] = actionId.split("#");
  const module = await import(/* @vite-ignore */ file!);
  const result = await module[name!](...args);
  return result;
}
