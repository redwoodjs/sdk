import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";
export { AppDurableObject } from "@/db/durableObject";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/__test/setup-cf-tables", async () => {
    const id = env.APP_DURABLE_OBJECT.idFromName("todo-database");
    const stub = env.APP_DURABLE_OBJECT.get(id);
    await (stub as any).setupCfTables();
    return new Response("ok");
  }),
  render(Document, [route("/", Home)]),
]);
