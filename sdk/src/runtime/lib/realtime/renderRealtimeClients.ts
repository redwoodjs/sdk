import { DEFAULT_REALTIME_KEY } from "./constants";
import { RealtimeDurableObject } from "./durableObject";

export const renderRealtimeClients = async ({
  durableObjectNamespace,
  key = DEFAULT_REALTIME_KEY,
  include,
  exclude,
}: {
  durableObjectNamespace: DurableObjectNamespace<RealtimeDurableObject>;
  key?: string;
  include?: string[];
  exclude?: string[];
}) => {
  const id = durableObjectNamespace.idFromName(key);
  const durableObject = durableObjectNamespace.get(id);
  await durableObject.render({ include, exclude });
};
