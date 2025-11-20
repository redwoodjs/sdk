// Re-export everything from client-core to maintain the public API
export {
  getSyncedStateClient,
  initSyncedStateClient,
  setSyncedStateClientForTesting,
} from "./client-core.js";
export type { SyncedStateClient } from "./client-core.js";

// Re-export useSyncedState (no circular dependency since useSyncedState imports from client-core, not client)
export { useSyncedState } from "./useSyncedState.js";
