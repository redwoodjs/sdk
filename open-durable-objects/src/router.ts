import { OpenDurableObject } from "./durable-object/index.js";
import { OpenDurableObjectRegistry } from "./registry.js";

export function createOpenDurableObjectRouter<T extends OpenDurableObject>(
  registry: OpenDurableObjectRegistry,
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
