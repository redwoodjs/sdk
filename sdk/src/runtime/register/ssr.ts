import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.edge";

const ssrCallServer = (id: string, args: any) => {
  const action = registeredServerFunctions.get(id);
  if (!action) {
    throw new Error(`Server function ${id} not found`);
  }
  return action(args);
};

export const createServerReference = (id: string, name: string) => {
  id = id + "#" + name;
  return baseCreateServerReference(id, ssrCallServer);
};

export const registeredServerFunctions: Map<string, Function> = new Map();
