import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setCommonHeaders } from "src/headers";
import { drizzle } from "drizzle-orm/d1";

export interface Env {
  DB: D1Database;
}

export type AppContext = {
  db: ReturnType<typeof drizzle>;
};

export default defineApp<AppContext>([
  setCommonHeaders(),
  ({ appContext, env }) => {
    // setup db in appContext
    appContext.db = drizzle(env.DB);
  },
  render(Document, [index([Home])]),
]);
