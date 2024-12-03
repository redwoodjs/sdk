import {
  registerServerReference as baseRegisterServerReference,
  registerClientReference as baseRegisterClientReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";
import memoize from "lodash/memoize";

const modules = (
  import.meta as object as {
    glob: (
      pattern: string,
    ) => Record<string, () => Promise<Record<string, unknown>>>;
  }
).glob("/src/app/**/*.{ts,tsx}");

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

export function registerClientReference(id: string, exportName: string) {
  const reference = baseRegisterClientReference({}, id, exportName);
  return Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(reference),
      $$async: { value: true },
    },
  );
}

export const loadModule = memoize(async (moduleName: string) => {
  return await modules[moduleName]();
});

export const getModuleExport = async (id: string) => {
  const [file, name] = id.split("#");
  const module = await loadModule(file);
  return module[name];
};

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const ssrWebpackRequire = memoize(async (id: string) => {
  const [file, name] = id.split("#");
  const module = await loadModule(file);
  return { [id]: module[`${name}SSR`] };
});

export async function rscActionHandler(req: Request): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  const data = contentType?.startsWith("multipart/form-data")
    ? await req.formData()
    : await req.text();

  const args = (await decodeReply(data, null)) as unknown[];
  const actionId = url.searchParams.get("__rsc_action_id");
  const action = await getModuleExport(actionId!);

  if (typeof action !== "function") {
    throw new Error(`Action ${actionId} is not a function`);
  }

  return action(...args);
}
