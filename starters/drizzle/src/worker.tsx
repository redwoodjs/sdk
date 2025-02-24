import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout } from '@redwoodjs/sdk/router';
import { Document } from 'src/Document';
import { Home } from 'src/pages/Home';
import { drizzle } from 'drizzle-orm/d1';

export interface Env {
  DB: D1Database;
}

type Context = {
  db: ReturnType<typeof drizzle>
}

export default defineApp<Context>([
  ({ ctx, env }) => {
    // setup db in ctx
    ctx.db = drizzle(env.DB);
  },
  layout(Document, [
    index([
      Home,
    ]),
  ]),
])
