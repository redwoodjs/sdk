import { Document } from 'app/Document';
import { HomePage } from 'app/pages/HomePage';
import { LoginPage } from 'app/pages/auth/LoginPage';
import { SignupPage } from 'app/pages/auth/SignupPage';
import { NewPage } from 'app/pages/applications/NewPage';
import { ListPage } from 'app/pages/applications/ListPage';
import { DetailPage } from 'app/pages/applications/DetailPage';
import { UpdatePage } from 'app/pages/applications/UpdatePage';
import { SettingsPage } from 'app/pages/account/SettingsPage';
import { TermsPage } from 'app/pages/legal/TermsPage';
import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout, route, prefix, RouteContext } from '@redwoodjs/sdk/router';
import { setupDb } from './db';

export type Context = {
  // user: Awaited<ReturnType<typeof getUser>>;
  params: Record<string, string>
}

const getParams = (request: Request) => {
  const url = new URL(request.url)
  const params = url.searchParams

  // if there's a key with "_rsc" remove it
  params.delete('_rsc')

  return Object.fromEntries(params.entries())
}

export default defineApp<Context>([
  async ({ ctx, env, request }) => {
    await setupDb(env)
    ctx.params = getParams(request)
  },
  layout(Document, [
    index([HomePage]),
    // auth
    route('/login', LoginPage),
    route('/signup', SignupPage),
    // route('/logout', LogoutPage),
    // applications
    prefix('/applications', [
      route('/', ListPage),
      route('/new', NewPage),
      route('/update', UpdatePage),
      route('/:id', DetailPage),
    ]),
    // legal
    route('/terms', TermsPage),
    // account
    route('/account/settings', SettingsPage),
  ]),
])
