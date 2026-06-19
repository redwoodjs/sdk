// Public client entry point for the hibernation-aware useSyncedState transport.
// This keeps the capnweb loader out of the bundle for apps that opt into hibernation.
export {
  getSyncedStateClient,
  setSyncedStateClientForTesting,
} from "./client-core.js";
export type {
  SyncedStateClient,
  SyncedStateStatus,
  StatusChangeCallback,
} from "./client-core.js";

export {
  useSyncedState,
  createSyncedStateHook,
} from "./useSyncedState.js";
