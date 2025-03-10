import { defineApp } from "redwoodsdk/worker";
import { index, layout } from "redwoodsdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setupDb } from "./db";
import { setCommonHeaders } from "src/headers";
type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  async ({ ctx, env, request }) => {
    await setupDb(env);
  },
  layout(Document, [index([Home])]),
]);
