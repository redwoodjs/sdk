## Worklog

1. Reviewed `sdk/src/use-server-state/useSyncState.ts` to confirm the factory still accepted `(url, deps)` and identified all call sites in code and docs.
2. Refactored `createSyncStateHook` to accept an options object with `url` and `hooks`, updated exports, and adjusted the unit test harness to pass the new structure.
3. Reworked `docs/src/content/docs/core/realtime.mdx` examples to use the options object and clarified the customization section to document the new keys.
4. Attempted to run `pnpm test -- --run --watch=false --filter createSyncStateHook`; the command failed because the sandbox blocked access to the Corepack cache file.

