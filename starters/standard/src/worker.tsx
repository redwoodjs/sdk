import { defineApp, ErrorResponse } from "@redwoodjs/sdk/worker";
import { route, render, prefix } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import { userRoutes } from "@/app/pages/user/routes";
import { sessions, setupSessionStore } from "./session/store";
import { Session } from "./session/durableObject";
import { db, setupDb } from "./db";
import type { User } from "@prisma/client";
import { env } from "cloudflare:workers";
import { requestContext } from "@redwoodjs/sdk/worker";
export { SessionDurableObject } from "./session/durableObject";

export type Data = {
  session: Session | null;
  user: User | null;
};

export default defineApp([
  setCommonHeaders(),
  async () => {
    const { request, headers, data } = requestContext;
    await setupDb(env);
    setupSessionStore(env);

    try {
      data.session = await sessions.load(request);
    } catch (error) {
      if (error instanceof ErrorResponse && error.code === 401) {
        await sessions.remove(request, headers);
        headers.set("Location", "/user/login");

        return new Response(null, {
          status: 302,
          headers,
        });
      }

      throw error;
    }

    if (data.session?.userId) {
      data.user = await db.user.findUnique({
        where: {
          id: data.session.userId,
        },
      });
    }
  },
  render(Document, [
    route("/", () => new Response("Hello, World!")),
    route("/protected", [
      () => {
        if (!requestContext.data.user) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/user/login" },
          });
        }
      },
      Home,
    ]),
    prefix("/user", userRoutes),
  ]),
]);
