import { performLogin } from "../../../auth";
import { db } from "../../../db";
import { route } from "../../../lib/router";
import { LoginPage } from "./LoginPage";


export const authRoutes = [
  route('/callback', async function({ request, env }) {
    // when it's async then react-is thinks it's a react component.
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    if (!token || !email) {
      return new Response("Invalid token or email", { status: 400 });
    }
    const user = await db
    .user.findFirst({
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

    return performLogin(request, env, user.id);
  }),
  route('/login', LoginPage),
  route('/logout', function({ request, env }) {
    console.log('### logout')
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `session_id=""; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      }
    });
  }),
]
