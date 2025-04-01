import { defineApp } from "@redwoodjs/sdk/worker";
import { route, render } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";

import {
  renderRealtimeClients,
  realtimeRoute,
} from "@redwoodjs/sdk/realtime/worker";
import Note from "./app/pages/note/Note";

export { RealtimeDurableObject } from "@redwoodjs/sdk/realtime/durableObject";
export { NoteDurableObject } from "@/noteDurableObject";

export type AppContext = {};

export default defineApp<AppContext>([
  setCommonHeaders(),
  realtimeRoute((env) => env.REALTIME_DURABLE_OBJECT),
  route("/api/note/:key", async ({ request, env, params }) => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    const body = await request.text();

    const id = env.NOTE_DURABLE_OBJECT.idFromName(params.key);
    const durableObject = env.NOTE_DURABLE_OBJECT.get(id);
    await durableObject.setContent(body);

    await renderRealtimeClients({
      durableObjectNamespace: env.REALTIME_DURABLE_OBJECT,
      key: `/note/${params.key}`,
    });

    return new Response(null, { status: 200 });
  }),
  render(Document, [
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
