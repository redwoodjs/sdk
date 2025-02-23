import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout, prefix } from '@redwoodjs/sdk/router';
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
  // todo: Figure out why I'm needing to provide route type param each time
  layout<Context>(Document, [
    index([
        Home,
    ]),
    prefix<Context>("/user", authRoutes),
  ])
])