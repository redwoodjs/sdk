// Public client entry point for the hibernation-aware useSyncedState transport.
// This keeps the capnweb loader out of the bundle for apps that opt into hibernation.
export {
  getSyncedStateClient,
  initSyncedStateClient,
  setSyncedStateClientForTesting,
} from "./client-core-hibernation.js";
export type {
  SyncedStateClient,
  SyncedStateStatus,
  StatusChangeCallback,
} from "./client-core-hibernation.js";

export {
  useSyncedState,
  createSyncedStateHook,
} from "./useSyncedStateHibernation.js";
