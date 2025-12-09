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
import { requestInfo } from "rwsdk/runtime/requestInfo/worker";

export { SyncedStateServer };

export type AppContext = {
  userId: string | null;
};

SyncedStateServer.registerKeyHandler(async (key) => {
  console.log("requestInfo");
  console.log(requestInfo.ctx);
  console.log("--------------------------------");
  // grab userId from search params from the requestInfo.

  // if the key starts with "user:", modify it to include the userId.
  if (key.startsWith("user:")) {
    // console.log("x");
    const k = `user:${(requestInfo.ctx as any).userId}:${key.slice(5)}`;
    // console.log("k", k);
    return k;
  }

  return key;
});

// Helper function to update presence list
async function updatePresenceList(
  namespace: DurableObjectNamespace<SyncedStateServer>,
  addUserId: string | null,
  removeUserId: string | null,
) {
  if (!addUserId && !removeUserId) return;

  // Get current presence list from Durable Object (source of truth)
  const id = namespace.idFromName("syncedState");
  const durableObjectStub = namespace.get(id);
  const currentPresence = (await durableObjectStub.getState("presence")) as
    | string[]
    | undefined;
  const presenceSet = new Set<string>(currentPresence || []);

  // Update the set
  if (addUserId) {
    presenceSet.add(addUserId);
  }
  if (removeUserId) {
    presenceSet.delete(removeUserId);
  }

  // Update the Durable Object state with the updated list
  const presenceList = Array.from(presenceSet);
  await durableObjectStub.setState(presenceList, "presence");
}

// Store namespace reference for handlers
let presenceNamespace: DurableObjectNamespace<SyncedStateServer> | null = null;

(SyncedStateServer as any).registerSubscribeHandler((key: string) => {
  if (key === "presence" && presenceNamespace) {
    const userId = (requestInfo.ctx as AppContext).userId;
    if (userId) {
      void updatePresenceList(presenceNamespace, userId, null);
    }
  }
});

(SyncedStateServer as any).registerUnsubscribeHandler((key: string) => {
  if (key === "presence" && presenceNamespace) {
    // Try to get userId from context first
    let userId = (requestInfo.ctx as AppContext).userId;

    // If userId is null, try to get it from cookie as fallback
    // This handles the case where the user logged out but the WebSocket
    // connection is still active and the component unmounts
    if (!userId && requestInfo.request) {
      try {
        const cookie = requestInfo.request.headers.get("Cookie");
        const match = cookie?.match(/userId=([^;]+)/);
        userId = match ? match[1] : null;
      } catch {
        // Ignore errors accessing request
      }
    }

    if (userId) {
      void updatePresenceList(presenceNamespace, null, userId);
    }
  }
});

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
    // Initialize presence namespace reference
    if (!presenceNamespace) {
      presenceNamespace = env.SYNCED_STATE_SERVER;
    }
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
      // Don't auto-generate userId - user must log in explicitly
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

    // Remove user from presence list if they were logged in
    // Await to ensure the update completes before redirecting
    if (userIdToRemove && presenceNamespace) {
      await updatePresenceList(presenceNamespace, null, userIdToRemove);
    }

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
