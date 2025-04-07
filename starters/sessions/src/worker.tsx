import { defineApp, ErrorResponse } from "@redwoodjs/sdk/worker";
import { index, render, prefix } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { userRoutes } from "@/app/pages/user/routes";
import { sessions, setupSessionStore } from "./session/store";
import { Session } from "./session/durableObject";
import { setCommonHeaders } from "./app/headers";
import { requestContext } from "@redwoodjs/sdk/worker";
import { env } from "cloudflare:workers";

export { SessionDurableObject } from "./session/durableObject";

export type Data = {
  session: Session | null;
};

export default defineApp([
  setCommonHeaders(),
  async () => {
    setupSessionStore(env);

    try {
      requestContext.data.session = await sessions.load(requestContext.request);
    } catch (error) {
      if (error instanceof ErrorResponse && error.code === 401) {
        await sessions.remove(requestContext.request, requestContext.headers);
        requestContext.headers.set("Location", "/user/login");

        return new Response(null, {
          status: 302,
          headers: requestContext.headers,
        });
      }
    }
  },
  render(Document, [index([Home]), prefix("/user", userRoutes)]),
]);
