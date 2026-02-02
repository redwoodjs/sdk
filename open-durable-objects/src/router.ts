import { OpenDO } from "./open-do.js";
import { OpenDORegistry } from "./registry.js";

export function createOpenDORouter<T extends OpenDO>(
  registry: OpenDORegistry,
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
