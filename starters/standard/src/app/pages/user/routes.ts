import { route } from "@redwoodjs/sdk/router";
import { Login } from "./Login";
import { sessions } from "@/session/store";
import { requestContext } from "@redwoodjs/sdk/worker";

export const userRoutes = [
  route("/login", [Login]),
  route("/logout", async function () {
    const headers = new Headers();
    await sessions.remove(requestContext.request, headers);
    headers.set("Location", "/");

    return new Response(null, {
      status: 302,
      headers,
    });
  }),
];
