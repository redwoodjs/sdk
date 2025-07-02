import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import { About } from "@/app/pages/About";
import { realtimeRoute } from "rwsdk/realtime/worker";

import { env } from "cloudflare:workers";

export type AppContext = {};

export { RealtimeDurableObject } from "rwsdk/realtime/durableObject";

export default defineApp([
  // setCommonHeaders(),
  // this cannot appear before middleware????
  realtimeRoute(() => env.REALTIME_DURABLE_OBJECT),
  render(Document, [route("/", Home), route("/about", About)]),
]);
