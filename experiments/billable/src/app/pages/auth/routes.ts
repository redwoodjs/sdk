import { db } from "src/db";
import { route, RouteDefinition } from "@redwoodjs/sdk/router";
import { LoginPage } from "./LoginPage";
import { link } from "src/shared/links";
import { sessions } from "@/sessionStore";

export const authRoutes: RouteDefinition[] = [
  route("/auth", async function ({ request }) {
    // when it's async then react-is thinks it's a react component.
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    if (!token || !email) {
      return new Response("Invalid token or email", { status: 400 });
    }
    const user = await db.user.findFirst({
      where: {
        email,
        authToken: token,
        authTokenExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return new Response("Invalid or expired token", { status: 400 });
    }

    // Clear the auth token
    await db.user.update({
      where: { id: user.id },
      data: {
        authToken: null,
        authTokenExpiresAt: null,
      },
    });

    console.log("performing login");

    const response = new Response(null, {
      status: 301,
      headers: {
        Location: link("/invoice/list"),
        "Content-Type": "text/html",
      },
    });

    return sessions.save(response, { userId: user.id });
  }),
  route("/login", LoginPage),
  route("/logout", function ({ request }) {
    return sessions.remove(
      request,
      new Response(null, {
        status: 302,
        headers: {
          Location: "/",
        },
      }),
    );
  }),
];
