import { OpenDurableObject } from "./durable-object/index.js";
import { ClusterCoordinator } from "./coordinator.js";

export function route<T extends OpenDurableObject>(
  registry: ClusterCoordinator,
  Ctor: new (state: any, env: any) => T,
  idExtractor: (req: Request) => string | null = (req) =>
    new URL(req.url).searchParams.get("id")
) {
  return async (req: Request): Promise<Response> => {
    const id = idExtractor(req);
    if (!id) {
      return new Response("Missing ID", { status: 400 });
    }

    const instance = await registry.get(id, Ctor);
    return instance.fetch(req);
  };
}
