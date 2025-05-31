import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.edge";
import { getServerModuleExport } from "../imports/worker.js";

const ssrCallServer = async (id: string, args: any) => {
  const action = await getServerModuleExport(id);

  if (typeof action !== "function") {
    throw new Error(`Server function ${id} is not a function`);
  }

  return action(...args);
};

export const createServerReference = (id: string, name: string) => {
  id = id + "#" + name;
  return baseCreateServerReference(id, ssrCallServer);
};
