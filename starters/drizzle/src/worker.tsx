import { defineApp } from "@redwoodjs/sdk/worker";
import { index, document } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setCommonHeaders } from "src/headers";
import { drizzle } from "drizzle-orm/d1";

export interface Env {
  DB: D1Database;
}

export type Context = {
  db: ReturnType<typeof drizzle>;
};

export default defineApp<Context>([
  setCommonHeaders(),
  ({ ctx, env }) => {
    // setup db in ctx
    ctx.db = drizzle(env.DB);
  },
  document(Document, [index([Home])]),
]);
