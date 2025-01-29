import { index, route } from "./router";

import { defineRoutes } from "./router";

const r = defineRoutes([
  index(() => 'Hello world'),
  route('/invoices', () => 'List of invoices'),
  route('/invoice/:id', () => 'A single invoice with an id'),

  route('auth/login', () => <div>Login</div>),
  route('auth/register', () => <div>Register</div>),
  route('auth/logout', () => {

    return new Response('Logged out', {
      status: 200,
    })
  }),
  route('assets/*', () => <div>Assets</div>),
])

r.handle(new Request('http://localhost:3000/auth/login'))
