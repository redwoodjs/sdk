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
import Note from "./app/pages/note/Note";

export { RealtimeDurableObject } from "redwoodsdk/realtime/durableObject";
export { NoteDurableObject } from "@/noteDurableObject";

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
          Location: `/note/${randomName}`,
        },
      });
    }),
    route("/note/:key", Note),
  ]),
]);
