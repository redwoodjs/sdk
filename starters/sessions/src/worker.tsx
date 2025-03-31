import { defineApp, ErrorResponse } from "@redwoodjs/sdk/worker";
import { index, render, prefix } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { userRoutes } from "@/app/pages/user/routes";
import { sessions, setupSessionStore } from "./session/store";
import { Session } from "./session/durableObject";
import { setCommonHeaders } from "./app/headers";

export { SessionDurableObject } from "./session/durableObject";

export type Context = {
  session: Session | null;
};

export default defineApp<Context>([
  setCommonHeaders(),
  async ({ env, ctx, request, headers }) => {
    setupSessionStore(env);

    try {
      ctx.session = await sessions.load(request);
    } catch (error) {
      if (error instanceof ErrorResponse && error.code === 401) {
        await sessions.remove(request, headers);
        headers.set("Location", "/user/login");

        return new Response(null, {
          status: 302,
          headers,
        });
      }
    }
  },
  render(Document, [index([Home]), prefix("/user", userRoutes)]),
]);
