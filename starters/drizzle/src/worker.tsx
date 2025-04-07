import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import { drizzle } from "drizzle-orm/d1";
import { requestContext } from "@redwoodjs/sdk/worker";
import { env } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
}

export type Data = {
  db: ReturnType<typeof drizzle>;
};

export default defineApp([
  setCommonHeaders(),
  () => {
    // setup db in data
    requestContext.data.db = drizzle(env.DB);
  },
  render(Document, [index([Home])]),
]);
