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

// In-memory store for presence list
const presenceSet = new Set<string>();

// Helper function to update presence list
async function updatePresenceList(
  namespace: DurableObjectNamespace<SyncedStateServer>,
  addUserId: string | null,
  removeUserId: string | null,
) {
  if (!addUserId && !removeUserId) return;

  // Update in-memory set
  if (addUserId) {
    presenceSet.add(addUserId);
  }
  if (removeUserId) {
    presenceSet.delete(removeUserId);
  }

  // Update the Durable Object state with the current list
  const presenceList = Array.from(presenceSet);
  const id = namespace.idFromName("syncedState");
  const durableObjectStub = namespace.get(id);
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
    const userId = (requestInfo.ctx as AppContext).userId;
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
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        const match = cookie.match(/userId=([^;]+)/);
        if (match) {
          ctx.userId = match[1];
        }
      }
      // If no userId found in query params or cookies, generate a new one
      if (!ctx.userId) {
        ctx.userId = generateUserId();
      }
      // Always set the cookie with the userId
      response.headers.set(
        "Set-Cookie",
        `userId=${ctx.userId}; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    }
  },
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
