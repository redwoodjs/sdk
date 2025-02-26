import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout, prefix } from '@redwoodjs/sdk/router';
import { Document } from '@/app/Document';
import { Home } from '@/app/pages/Home';
import { authRoutes } from '@/app/pages/auth/routes';
import { sessions, setupSessionStore } from './session/store';
import { Session } from './session/durableObject';
import { db, setupDb } from './db';
import { User } from '@prisma/client';
export { SessionDurableObject } from './session/durableObject';

export type Context = {
  session: Session | null;
  user: User | null;
}

export default defineApp<Context>([
  async ({ env, ctx, request }) => {
    setupDb(env);
    setupSessionStore(env);
    ctx.session = await sessions.load(request);

    if (ctx.session?.userId) {
      ctx.user = await db.user.findUnique({
        where: {
          id: ctx.session.userId,
        },
      });
    }
  },
  // todo: Figure out why I'm needing to provide route type param each time
  layout<Context>(Document, [
    index([
        ({ ctx }) => {
          if (!ctx.user) {
            return new Response(null, {
              status: 302,
              headers: { Location: '/user/login' }
            });
          }
        },
        Home,
    ]),
    prefix<Context>("/user", authRoutes),
  ])
])