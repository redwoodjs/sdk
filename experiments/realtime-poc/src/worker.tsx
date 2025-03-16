import { defineApp } from "redwoodsdk/worker";
import { route, layout } from "redwoodsdk/router";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { sessions, setupSessionStore } from "./session/store";
import { Session } from "./session/durableObject";
import { db, setupDb } from "./db";
export { SessionDurableObject } from "./session/durableObject";

export type Context = {
  session: Session | null;
  user: User | null;
};

export default defineApp<Context>([
  setCommonHeaders(),
  async ({ env, ctx, request }) => {},
  layout(Document, [route("/", ({ ctx }) => {})]),
]);
