import { defineApp } from '@redwoodjs/reloaded/worker';
import { index, layout, prefix } from '@redwoodjs/reloaded/router';
import { ExecutionContext } from '@cloudflare/workers-types';

import { link } from "src/shared/links";
import { Document } from 'src/Document';
import { getSession } from './auth';
import { authRoutes } from 'src/pages/auth/routes';
import { invoiceRoutes } from 'src/pages/invoice/routes';
import HomePage from 'src/pages/Home/HomePage';
import { setup } from './setup';
import { db, setupDb } from './db';

export { SessionDO } from "./session";

export type Context = {
  user: Awaited<ReturnType<typeof getUser>>;
}

export const getUser = async (
  request: Request,
  env: Env,
) => {
  try {
    const session = await getSession(request, env);
    const user = await db.user.findFirstOrThrow({
      select: {
        id: true,
        email: true,
      },
      where: { id: session?.userId },
    });
    return user;
  } catch (e) {
    return null;
  }
};

const app = defineApp<Context>([
  async ({ request, ctx, env }) => {
    setupDb(env)
    ctx.user = await getUser(request, env)
  },
  layout(Document, [
    index([
        ({ ctx }) => {
          if (ctx.user) {
            return new Response(null, {
              status: 302,
              headers: { Location: link('/invoice/list') },
            });
          }
        },
        HomePage,
    ]),
    prefix("/user", authRoutes),
    prefix("/invoice", invoiceRoutes),
  ])
])

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
}