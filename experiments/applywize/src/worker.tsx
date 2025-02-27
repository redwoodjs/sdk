import { Document } from 'app/Document';
import { HomePage } from 'app/pages/HomePage';
import { authRoutes } from '@/app/pages/auth/routes';
import { NewPage } from 'app/pages/applications/NewPage';
import { ListPage } from 'app/pages/applications/ListPage';
import { DetailPage } from 'app/pages/applications/DetailPage';
import { UpdatePage } from 'app/pages/applications/UpdatePage';
import { SettingsPage } from 'app/pages/account/SettingsPage';
import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout, route, prefix } from '@redwoodjs/sdk/router';
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
  async ({ ctx, env, request }) => {
    await setupDb(env)
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
  layout<Context>(Document, [
    index([
        // ({ ctx }) => {
        //   if (!ctx.user) {
        //     return new Response(null, {
        //       status: 302,
        //       headers: { Location: '/user/login' }
        //     });
        //   }
        // },
        HomePage,
    ]),
    // auth
    prefix<Context>("/auth", authRoutes),
    // applications
    route<Context>('/applications', ListPage),
    prefix<Context>("/applications", [
      route('/new', NewPage),
      route('/update', UpdatePage),
      route('/:id', DetailPage),
    ]),
    // account
    route('/account/settings', SettingsPage),
  ]),
])
