import { defineApp } from 'redwoodsdk/worker';
import { index, layout } from 'redwoodsdk/router';
import { Document } from 'src/Document';
import { Home } from 'src/pages/Home';
import { setupDb } from './db';

type Context = {
}

export default defineApp<Context>([
  async ({ ctx, env, request }) => {
    await setupDb(env)
  },
  layout(Document, [
    index([
      Home,
    ]),
  ]),
])
