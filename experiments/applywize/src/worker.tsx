import { Document } from 'app/Document';
import { HomePage } from 'app/pages/HomePage';
import { LoginPage } from 'app/pages/auth/LoginPage';
import { SignupPage } from 'app/pages/auth/SignupPage';
import { LogoutPage } from 'app/pages/auth/LogoutPage';
import { NewPage } from 'app/pages/applications/NewPage';
import { ListPage } from 'app/pages/applications/ListPage';
import { DetailPage } from 'app/pages/applications/DetailPage';
import { UpdatePage } from 'app/pages/applications/UpdatePage';
import { SettingsPage } from 'app/pages/account/SettingsPage';
import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout, route, prefix } from '@redwoodjs/sdk/router';
import { setupDb } from './db';

export { SessionDO } from "./session";

// Add this import
import { handleAssets } from './assets';

export type Context = {
  // user: Awaited<ReturnType<typeof getUser>>;
}

export default defineApp<Context>([
  async ({ ctx, env, request }) => {
    // Try assets first
    // const assetResponse = await handleAssets(request, env);
    // if (assetResponse) return assetResponse;

    await setupDb(env)
    // ctx.user = await getUser(request, env)
  },
  layout(Document, [
    index([HomePage]),
    // auth
    route('/login', LoginPage),
    route('/signup', SignupPage),
    route('/logout', LogoutPage),
    // applications
    prefix('/applications', [
      route('/', ListPage),
      route('/new', NewPage),
      route('/update', UpdatePage),
      route('/:id', DetailPage),
    ]),
    // account
    route('/account/settings', SettingsPage),
  ]),
])
