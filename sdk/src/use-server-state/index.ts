export { initSyncedStateClient } from "./client";
export {
  DEFAULT_SYNCED_STATE_NAME,
  DEFAULT_SYNCED_STATE_PATH,
  DEFAULT_SYNCED_STATE_RESET_PATH,
} from "./constants.mjs";
export type { SyncedStateValue } from "./Coordinator.mjs";
export { createSyncedStateHook, useSyncedState } from "./useSyncedState";
