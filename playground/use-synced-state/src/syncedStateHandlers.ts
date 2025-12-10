import { requestInfo } from "rwsdk/runtime/requestInfo/worker";
import { SyncedStateServer } from "rwsdk/use-synced-state/worker";

import type { AppContext } from "./worker";

// Ephemeral state mirror for validation
export const globalState: Record<string, unknown> = {};

// Store namespace reference for handlers
let presenceNamespace: DurableObjectNamespace<SyncedStateServer> | null = null;

// Helper function to update presence list
export async function updatePresenceList(
  namespace: DurableObjectNamespace<SyncedStateServer>,
  addUserId: string | null,
  removeUserId: string | null,
) {
  if (!addUserId && !removeUserId) return;

  // Get current presence list from global state (source of truth)
  const currentPresence = (globalState["presence"] as string[]) || [];
  const presenceSet = new Set<string>(currentPresence);

  // Update the set
  if (addUserId) {
    presenceSet.add(addUserId);
  }
  if (removeUserId) {
    presenceSet.delete(removeUserId);
  }

  // Update the Durable Object state with the updated list
  const presenceList = Array.from(presenceSet);
  const id = namespace.idFromName("syncedState");
  const durableObjectStub = namespace.get(id);
  await durableObjectStub.setState(presenceList, "presence");
}

export function registerSyncedStateHandlers(
  getNamespace: () => DurableObjectNamespace<SyncedStateServer> | undefined,
) {
  // Store namespace reference for presence handlers
  const namespace = getNamespace();
  if (namespace) {
    presenceNamespace = namespace;
  }

  // Helper function to sync globalState to the Durable Object
  async function syncGlobalState() {
    // Get namespace from provider
    const namespace = getNamespace();
    if (!namespace) {
      return;
    }
    const id = namespace.idFromName("syncedState");
    const durableObjectStub = namespace.get(id);
    await durableObjectStub.setState(globalState, "STATE");
  }

  // Register setStateHandler to mirror all state updates to globalState
  SyncedStateServer.registerSetStateHandler((key: string, value: unknown) => {
    // Ignore updates to "STATE" itself to prevent infinite loops
    if (key === "STATE") {
      return;
    }
    // Update the local globalState object
    globalState[key] = value;
    // Sync to the Durable Object for client access
    void syncGlobalState();
  });

  // Register getStateHandler to mirror all state reads to globalState
  SyncedStateServer.registerGetStateHandler((key: string, value: unknown) => {
    // Ignore reads of "STATE" itself to prevent infinite loops
    if (key === "STATE") {
      return;
    }
    // Update the local globalState object with the retrieved value
    globalState[key] = value;
    // Sync to the Durable Object for client access
    void syncGlobalState();
  });

  SyncedStateServer.registerKeyHandler(async (key) => {
    // if the key starts with "user:", modify it to include the userId.
    if (key.startsWith("user:")) {
      key = `user:${(requestInfo.ctx as any).userId}:${key.slice(5)}`;
    }
    // "user:counter" -> "user:123:counter"

    return key;
  });

  SyncedStateServer.registerSubscribeHandler((key: string) => {


    //
    // if (key === "presence" && presenceNamespace) {
      // Try to get userId from context first
      let userId = (requestInfo.ctx as AppContext).userId;
      console.log('registerSubscribeHandler', userId, key)

      // If userId is null, try to get it from cookie as fallback
      // This handles the case where the user logged in but the WebSocket
      // connection was established before login or context isn't available
      // if (!userId && requestInfo.request) {
      //   try {
      //     const cookie = requestInfo.request.headers.get("Cookie");
      //     const match = cookie?.match(/userId=([^;]+)/);
      //     userId = match ? match[1] : null;
      //   } catch {
      //     // Ignore errors accessing request
      //   }
      // }

      if (userId) {
        void updatePresenceList(presenceNamespace, userId, null);
      }
    // }
  });

  SyncedStateServer.registerUnsubscribeHandler((key: string) => {


    // if (key === "presence" && presenceNamespace) {
      // Try to get userId from context first
      let userId = (requestInfo.ctx as AppContext).userId;
      console.log('registerUnsubscribeHandler', userId, key)

      // If userId is null, try to get it from cookie as fallback
      // This handles the case where the user logged out but the WebSocket
      // connection is still active and the component unmounts
      // if (!userId && requestInfo.request) {
      //   try {
      //     const cookie = requestInfo.request.headers.get("Cookie");
      //     const match = cookie?.match(/userId=([^;]+)/);
      //     userId = match ? match[1] : null;
      //   } catch {
      //     // Ignore errors accessing request
      //   }
      // }

      if (userId) {
        void updatePresenceList(presenceNamespace, null, userId);
      }
    // }
  });
}
