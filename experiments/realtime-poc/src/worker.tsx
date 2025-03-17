import { defineApp } from "redwoodsdk/worker";
import { route, layout } from "redwoodsdk/router";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";

import { realtimeRoute } from "redwoodsdk/realtime/worker";
import { Editor } from "./app/pages/editor/Editor";

export { RealtimeDurableObject } from "redwoodsdk/realtime/durableObject";
export { DocumentDurableObject } from "@/documentDurableObject";

export type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  realtimeRoute((env) => env.REALTIME_DURABLE_OBJECT),
  layout(Document, [
    route("/", () => {
      const randomName = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        separator: "-",
        length: 3,
      });

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/${randomName}`,
        },
      });
    }),
    route("/:key", Editor),
  ]),
]);
