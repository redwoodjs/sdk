import { SyncedStateServer } from "rwsdk/use-synced-state/worker";
import { requestInfo } from "rwsdk/worker";

// Ephemeral state mirror for validation, keyed by Durable Object ID
export const globalStateMap: Map<string, Record<string, unknown>> = new Map();

function getGlobalState(stub: DurableObjectStub<any>): Record<string, unknown> {
  const id = stub.id.toString();
  if (!globalStateMap.has(id)) {
    globalStateMap.set(id, {});
  }
  return globalStateMap.get(id)!;
}

// Helper function to update presence list
export async function updatePresenceList(
  stub: DurableObjectStub<SyncedStateServer>,
  addUserId: string | null,
  removeUserId: string | null,
) {
  if (!addUserId && !removeUserId) return;

  // Get current presence list from the Durable Object (source of truth)
  const currentPresence = ((await stub.getState("presence")) as string[]) || [];
  const presenceSet = new Set<string>(currentPresence);

  // Update the set
  if (addUserId) {
    presenceSet.add(addUserId);
  }
  if (removeUserId) {
    presenceSet.delete(removeUserId);
  }

  console.log("presenceSet", presenceSet);

  // Update the Durable Object state with the updated list
  const presenceList = Array.from(presenceSet);
  await stub.setState(presenceList, "presence");
}

export function registerSyncedStateHandlers(
  getNamespace: () => DurableObjectNamespace<SyncedStateServer> | undefined,
) {
  // Helper function to sync globalState to the Durable Object
  async function syncGlobalState(
    stub: DurableObjectStub<SyncedStateServer>,
    state: Record<string, unknown>,
  ) {
    console.log("[syncGlobalState]", { stateKeys: Object.keys(state) });
    try {
      await stub.setState(state, "STATE");
      console.log("[syncGlobalState] success");
    } catch (error) {
      console.error("[syncGlobalState] error", error);
    }
  }

  // Register setStateHandler to mirror all state updates to globalState
  SyncedStateServer.registerSetStateHandler(
    (
      key: string,
      value: unknown,
      stub: DurableObjectStub<SyncedStateServer>,
    ) => {
      // Ignore updates to "STATE" itself to prevent infinite loops
      if (key === "STATE") {
        return;
      }
      console.log("[setStateHandler]", { key, value });
      // Update the local globalState object
      const globalState = getGlobalState(stub);
      globalState[key] = value;
      console.log(
        "[setStateHandler] updated globalState, allKeys:",
        Object.keys(globalState),
      );
      // Sync to the Durable Object for client access
      void syncGlobalState(stub, globalState);
    },
  );

  // Register getStateHandler to mirror all state reads to globalState
  SyncedStateServer.registerGetStateHandler(
    (
      key: string,
      value: unknown,
      stub: DurableObjectStub<SyncedStateServer>,
    ) => {
      // Ignore reads of "STATE" itself to prevent infinite loops
      if (key === "STATE") {
        return;
      }
      console.log("[getStateHandler]", { key, value });
      // Update the local globalState object with the retrieved value
      const globalState = getGlobalState(stub);
      globalState[key] = value;
      console.log(
        "[getStateHandler] updated globalState, allKeys:",
        Object.keys(globalState),
      );
      // Sync to the Durable Object for client access
      void syncGlobalState(stub, globalState);
    },
  );

  // Register roomHandler to demonstrate server-side room transformation
  // This allows the server to map client-requested room IDs to actual Durable Object names
  SyncedStateServer.registerRoomHandler(
    async (roomId: string | undefined, reqInfo: any) => {
      // Access userId from the request context
      // The reqInfo parameter is the RequestInfo from the runtime, which has ctx
      const userId = reqInfo?.ctx?.userId;

      // If no roomId is provided, use the default
      if (!roomId) {
        return "syncedState";
      }

      // Transform "private" room requests to user-specific rooms
      if (roomId === "private" && userId) {
        return `user:${userId}`;
      }

      // Transform "shared" room requests to a common room
      if (roomId === "shared") {
        return "shared-room";
      }

      // For all other room IDs, pass them through as-is
      // This allows explicit room names like "my-room" to work
      return roomId;
    },
  );

  SyncedStateServer.registerKeyHandler(
    async (key: string, stub: DurableObjectStub<SyncedStateServer>) => {
      // if the key starts with "user:", modify it to include the userId.
      if (key.startsWith("user:")) {
        key = key + ":" + requestInfo.ctx.userId;
      }
      return key;
    },
  );

  SyncedStateServer.registerSubscribeHandler(
    (key: string, stub: DurableObjectStub<SyncedStateServer>) => {
      const userId = requestInfo.ctx.userId;
      if (key === "presence" && userId) {
        console.log("updatePresenceList", userId);
        void updatePresenceList(stub, userId, null);
      }
    },
  );

  SyncedStateServer.registerUnsubscribeHandler(
    (key: string, stub: DurableObjectStub<SyncedStateServer>) => {
      const userId = requestInfo.ctx.userId;
      if (key === "presence" && userId) {
        console.log("updatePresenceList", userId);
        void updatePresenceList(stub, null, userId);
      }
    },
  );
}
