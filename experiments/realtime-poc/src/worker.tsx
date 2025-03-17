import { defineApp } from "redwoodsdk/worker";
import { route, layout } from "redwoodsdk/router";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";

import { realtimeRoute } from "redwoodsdk/realtime/worker";
export { RealtimeDurableObject } from "redwoodsdk/realtime/durableObject";

export type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  realtimeRoute((env) => env.REALTIME_DURABLE_OBJECT),
  layout(Document, [route("/", ({ ctx }) => {})]),
]);
