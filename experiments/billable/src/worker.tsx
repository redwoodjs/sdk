import { db, defineApp, index, prefix } from '@redwoodjs/reloaded/worker';

import { link } from "src/shared/links";
import { Head } from 'src/Head';
import { getSession } from './auth';
import { authRoutes } from 'src/pages/auth/routes';
import { invoiceRoutes } from 'src/pages/invoice/routes';
import HomePage from 'src/pages/Home/HomePage';
export { SessionDO } from "./session";

export const getContext = async (
  request: Request,
  env: Env,
) => {
  const session = await getSession(request, env);
  const user = await db.user.findFirstOrThrow({
    select: {
      id: true,
      email: true,
    },
    where: { id: session?.userId },
  });
  return {
    user,
  };
};

const routes = [
  index([
    function ({ ctx }) {
      if (ctx.user) {
        return new Response(null, {
          status: 302,
          headers: { Location: link('/invoice/list') },
        });
      }
    },
    HomePage,
  ]),
  ...prefix("/user", authRoutes),
  ...prefix("/invoice", invoiceRoutes),
]

export default defineApp<ReturnType<typeof getContext>>({
  Head,
  getContext,
  routes,
})