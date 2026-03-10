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
import { registerSyncedStateHandlers } from "./syncedStateHandlers";

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
  // --GROK--: Server-side tick endpoint that mirrors PRZM's broadcastDriverLocation pattern.
  // Writes to the DO via stub.setState() (server-side RPC), NOT via client WebSocket.
  // This triggers #notifySubscribers which pushes to all WebSocket-connected clients.
  route("/api/tick", async () => {
    const namespace = env.SYNCED_STATE_SERVER;
    const id = namespace.idFromName("syncedState");
    const stub = namespace.get(id);

    const current = (await stub.getState("server-tick")) as number | undefined;
    const next = (current ?? 0) + 1;
    await stub.setState(next, "server-tick");

    return new Response(JSON.stringify({ tick: next }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
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
  route("/logout", ({ response }) => {
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
