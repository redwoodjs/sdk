import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.browser";

export function createServerReference(id: string, name: string) {
  id = id + "#" + name;
  return baseCreateServerReference(id, (...args: unknown[]) => {
    throw new Error("unexpected callServer during SSR");
  });
}
