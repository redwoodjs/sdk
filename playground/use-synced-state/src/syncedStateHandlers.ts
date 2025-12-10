import { SyncedStateServer } from "rwsdk/use-synced-state/worker";
import { requestInfo } from "rwsdk/worker";

// Ephemeral state mirror for validation
export const globalState: Record<string, unknown> = {};

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
      globalState[key] = value;
      console.log(
        "[getStateHandler] updated globalState, allKeys:",
        Object.keys(globalState),
      );
      // Sync to the Durable Object for client access
      void syncGlobalState(stub, globalState);
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
