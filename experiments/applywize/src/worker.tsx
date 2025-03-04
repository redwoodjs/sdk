import { Document } from 'app/Document';
import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout, route, prefix, RouteContext } from '@redwoodjs/sdk/router';
import { db, setupDb } from './db';
import { sessions, setupSessionStore } from '@/session/store';
import { User } from '@prisma/client';

// page components
import { LoginPage } from 'app/pages/auth/LoginPage';
import { SignupPage } from 'app/pages/auth/SignupPage';
import { NewPage } from 'app/pages/applications/NewPage';
import { ListPage } from 'app/pages/applications/ListPage';
import { DetailPage } from 'app/pages/applications/DetailPage';
import { UpdatePage } from 'app/pages/applications/UpdatePage';
import { SettingsPage } from 'app/pages/account/SettingsPage';
import { TermsPage } from 'app/pages/legal/TermsPage';
import { Session } from './session/durableObject';
import { link } from 'app/shared/links';
export { SessionDurableObject } from './session/durableObject';

export type Context = {
  params: Record<string, string>
  session: Session | null;
  user: User | null;
}

const getParams = (request: Request) => {
  const url = new URL(request.url)
  const params = url.searchParams

  // if there's a key with "_rsc" remove it
  params.delete('_rsc')

  return Object.fromEntries(params.entries())
}

function isAuthenticated({ ctx }: { ctx: Context }) {
  if (!ctx.user) {
    return new Response(null, {
      status: 302,
      headers: { Location: link("/login") },
    });
  }
}

function redirectToApplications({ ctx }: { ctx: Context }) {
  if (ctx.user) {
    return new Response(null, {
      status: 302,
      headers: { Location: link("/applications") },
    });
  }
}

export default defineApp<Context>([
  async ({ ctx, env, request }) => {
    await setupDb(env)
    ctx.params = getParams(request)
    setupSessionStore(env);
    ctx.session = await sessions.load(request);

    if (ctx.session?.userId) {
      ctx.user = await db.user.findUnique({
        where: {
          id: ctx.session.userId,
        },
      });
      console.log(ctx.user);
    }

    console.log(ctx.session);
  },
  layout(Document, [
    index([({ ctx }) => {
        if (!ctx.user) {
          return new Response(null, {
            status: 302,
            headers: { Location: '/login' }
          });
        }
        return new Response(null, {
          status: 302,
          headers: { Location: '/applications' }
        });
      },
    ]),
    // auth
    route('/login', [redirectToApplications, LoginPage]),
    route('/signup', [redirectToApplications, SignupPage]),
    route('/logout', async function ({ request }) {
      const headers = new Headers();
      await sessions.remove(request, headers);
      headers.set('Location', '/');

      return new Response(null, {
        status: 302,
        headers,
      });
    }),
    // applications
    prefix('/applications', [
      route('/', [isAuthenticated, ListPage]),
      route('/new', [isAuthenticated, NewPage]),
      route('/update', [isAuthenticated, UpdatePage]),
      route('/:id', [isAuthenticated, DetailPage]),
    ]),
    // legal
    route('/terms', TermsPage),
    // account
    route('/account/settings', [isAuthenticated, SettingsPage]),
  ]),
])
