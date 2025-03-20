import { defineApp } from "@redwoodjs/sdk/worker";
import { index, layout, prefix } from "@redwoodjs/sdk/router";
import { ExecutionContext } from "@cloudflare/workers-types";

import { link } from "src/shared/links";
import { Document } from "src/Document";
import { authRoutes } from "src/pages/auth/routes";
import { invoiceRoutes } from "src/pages/invoice/routes";
import HomePage from "src/pages/Home/HomePage";
import { db, setupDb } from "./db";
import { sessions, setupSessionStore } from "./sessionStore";

export { SessionDO } from "./session";

export type Context = {
  user: Awaited<ReturnType<typeof getUser>>;
};

export const getUser = async (request: Request) => {
  try {
    const session = await sessions.load(request);

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
    await setupDb(env);
    setupSessionStore(env);
    ctx.user = await getUser(request);
  },
  layout(Document, [
    index([
      ({ ctx }) => {
        if (ctx.user) {
          return new Response(null, {
            status: 302,
            headers: { Location: link("/invoice/list") },
          });
        }
      },
      HomePage,
    ]),
    prefix("/user", authRoutes),
    prefix("/invoice", invoiceRoutes),
  ]),
]);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
