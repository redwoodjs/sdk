import {
  registerServerReference as baseRegisterServerReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";

const modules = import.meta.glob("/src/**/*.ts");

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

const getAction = async (actionId: string) => {
  const [file, name] = actionId.split("#");
  const module = await modules[file]();
  return module[name];
};

export async function rscActionHandler(req: Request): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  const data = contentType?.startsWith("multipart/form-data")
    ? await req.formData()
    : await req.text();

  const args = (await decodeReply(data, null)) as unknown[];
  const actionId = url.searchParams.get("__rsc_action_id");
  const action = await getAction(actionId!);

  if (typeof action !== "function") {
    throw new Error(`Action ${actionId} is not a function`);
  }

  return action(...args);
}
