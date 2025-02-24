import { route, RouteDefinition } from '@redwoodjs/sdk/router';
import { LoginPage } from "./LoginPage";
import { sessions } from '@/session/store';
import { Context } from '@/worker';

export const authRoutes: RouteDefinition<Context>[] = [
  route('/login', [
    LoginPage
  ]),
  route('/logout', function ({ request }) {
    const headers = new Headers();
    sessions.remove(request, headers);
    headers.set('Location', '/');

    return new Response(null, {
      status: 302,
      headers,
    });
  }),
]
