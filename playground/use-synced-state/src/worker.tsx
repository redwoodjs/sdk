import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import {
  SyncedStateServer,
  syncedStateRoutes,
} from "rwsdk/use-synced-state/worker";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";
import {
  registerSyncedStateHandlers,
  updatePresenceList,
} from "./syncedStateHandlers";

registerSyncedStateHandlers(() => env.SYNCED_STATE_SERVER);

export { SyncedStateServer };

export type AppContext = {
  userId: string | null;
};

function generateUserId(): string {
  // Generate a simple random number between 100 and 9999
  const min = 100;
  const max = 9999;
  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomNum.toString();
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx, request, response }) => {
    // grab userID from search params in request.
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (userId) {
      ctx.userId = userId;
      response.headers.set(
        "Set-Cookie",
        `userId=${userId}; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } else {
      // Check for userId in cookie
      const cookie = request.headers.get("Cookie");
      const match = cookie?.match(/userId=([^;]+)/);
      ctx.userId = match ? match[1] : null;
    }
  },
  route("/login", ({ response }) => {
    // Generate a new userId and set the cookie
    const userId = generateUserId();
    response.headers.set(
      "Set-Cookie",
      `userId=${userId}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    response.headers.set("Location", "/");
    return new Response(null, {
      status: 302,
      headers: response.headers,
    });
  }),
  route("/logout", async ({ request, response, ctx }) => {
    // Read userId from cookie before clearing it, so we can remove them from presence
    const cookie = request.headers.get("Cookie");
    const match = cookie?.match(/userId=([^;]+)/);
    const userIdToRemove = match ? match[1] : ctx.userId;

    await updatePresenceList(null, userIdToRemove);

    // Clear the userId cookie and redirect to home
    response.headers.set(
      "Set-Cookie",
      "userId=; Path=/; Max-Age=0; SameSite=Lax",
    );
    response.headers.set("Location", "/");
    return new Response(null, {
      status: 302,
      headers: response.headers,
    });
  }),
  render(Document, [route("/", Home)]),
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
]);
