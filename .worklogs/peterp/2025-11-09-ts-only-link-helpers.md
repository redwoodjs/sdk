# TS-only link helpers

## 11:40 Requirement update

User prohibited manifest/codegen approach. Need to redesign link helper to rely only on TypeScript inference. Drafted architecture note capturing new plan.

## Current status

Architecture doc updated. Next: implement TypeScript-only helper and update references.

## 12:30 Implementation

Updated router types to carry original path metadata, added tuple-preserving generics on `render`, `layout`, and `prefix`, and stored routes on the app definition. Reworked `links.ts` to expose `linkFor`, `createLinks`, and stricter runtime interpolation with parameter validation. Swapped starter and playground link helpers to use type-only `worker` imports, refreshed docs, and added runtime unit tests with `pnpm exec vitest --run sdk/src/runtime/lib/links.test.ts`.

## 12:55 Build regression

`pnpm build:sdk` failed because the new `prefix` typing triggered excessive recursion and the runtime helpers returned arrays that TypeScript could not reconcile. Added base cases to the type helpers, narrowed array branches with casts, and restored metadata on `route` definitions. Build now completes and router/link unit tests pass.

## Current status

Implementation and documentation complete. Awaiting review.

