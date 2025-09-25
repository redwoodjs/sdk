import { route } from "rwsdk/router";
import { Login } from "./Login";
import { sessions } from "@/session/store";

export const userRoutes = [
  route("/login", [Login]),
  route("/logout", async function ({ request, response }) {
    await sessions.remove(request, response.headers);
    response.headers.set("Location", "/");

    return new Response(null, {
      status: 302,
      headers: response.headers,
    });
  }),
];
