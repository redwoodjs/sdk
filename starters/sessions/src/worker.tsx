import { defineApp } from 'redwoodsdk/worker';
import { index, layout, prefix } from 'redwoodsdk/router';
import { Document } from '@/app/Document';
import { Home } from '@/app/pages/Home';
import { authRoutes } from '@/app/pages/auth/routes';
import { sessions, setupSessionStore } from './session/store';
import { Session } from './session/durableObject';

export { SessionDurableObject } from './session/durableObject';

export type Context = {
  session: Session | null;
}

export default defineApp<Context>([
  async ({ env, ctx, request }) => {
    setupSessionStore(env);
    ctx.session = await sessions.load(request);
  },
  layout(Document, [
    index([
        Home,
    ]),
    prefix("/user", authRoutes),
  ])
])