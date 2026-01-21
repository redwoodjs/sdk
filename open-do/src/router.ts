import { OpenDO } from "./OpenDO.js";
import { OpenDORegistry } from "./OpenDORegistry.js";

export function createOpenDORouter<T extends OpenDO>(
  registry: OpenDORegistry,
  Ctor: new () => T,
  idExtractor: (req: Request) => string | null = (req) =>
    new URL(req.url).searchParams.get("id")
) {
  return async (req: Request): Promise<Response> => {
    const id = idExtractor(req);
    if (!id) {
      return new Response("Missing ID", { status: 400 });
    }

    const instance = registry.getOrCreateInstance(id, Ctor);
    return instance.fetch(req);
  };
}
