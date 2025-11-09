## Context
- `pnpm build` failed with TypeScript errors in `sdk`.

## Attempts
1. Ran `pnpm build` inside `sdk` to capture the error list. Identified issues in `src/runtime/imports/client.ts` and the `use-server-state` tests.
2. Added an explicit type for the `virtual:use-client-lookup.js` import and introduced `ModuleExports` typing. Adjusted lazy loading to cast component exports to `React.ComponentType`, resolving the runtime file errors.
3. Imported `RpcStub` in `Coordinator.test.mts` and cast the stub factory output so it matches the expected subscriber type.
4. Reworked the `useSyncState` test harness to implement the `HookDeps` contract, adding typed implementations for the hook dependencies and clearing implicit `any` usage.

## Outcome
- `pnpm build` completes without TypeScript errors.

