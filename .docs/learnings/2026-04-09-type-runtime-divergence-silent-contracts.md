# Learning: Type/Runtime Divergence and Silent Contract Violations

**Date**: 2026-04-09
**Context**: Issue #1123 investigation
**Category**: Architectural risk
**Severity**: High

---

## The Pattern

A TypeScript type, JSDoc comment, or documentation page describes an API contract. A refactor modifies the runtime implementation without updating the type/docs. The type signature and documentation remain valid TypeScript and valid prose, so no compiler warning or documentation build failure occurs. However, the contract is silently violated at runtime — the documented behavior does not match what the code does.

This creates a **silent contract violation** with no automated signal.

---

## Real-world example: Issue #1123

The `onNavigate` option in `ClientNavigationOptions`:

- **TypeScript type** (`sdk/src/runtime/client/navigation.ts` line 11): `onNavigate?: () => void`
- **JSDoc comment** (line 123): `@param opts.onNavigate - Callback executed after history push but before RSC fetch`
- **Reference documentation** (`docs/reference/sdk-client.mdx` line 136): *"Callback executed **after** the history entry is pushed but **before** the new RSC payload is fetched."*
- **Guide documentation** (`docs/guides/frontend/client-side-nav.mdx` lines 88–97): A working code example showing `onNavigate: async () => { await analytics.track(...) }`

**Reality**: The callback is accepted by the function signature but never invoked. A user who passes `onNavigate: myFn` receives no error and no warning — the function is silently discarded.

The root cause was a refactor (commit `c543ef7`, PR #804) that extracted navigation logic into a standalone function. The new function did not accept an `onNavigate` parameter, and the call sites were deleted. The type and documentation were never updated. Nobody noticed because:

1. TypeScript accepted the code (the parameter is optional)
2. The build succeeded
3. No test verified the callback was invoked
4. The documentation build succeeded (JSDoc is not validated against implementation)

---

## Why this is dangerous

1. **Trust damage**: Users follow the documentation and implement code that should work. The code runs without error but silently doesn't do what they expect.
2. **Late discovery**: The bug may not surface until integration testing or production.
3. **Cascading refactors**: Later refactors might assume the callback works (since it's documented as working) and build on top of it, compounding the violation.

---

## Detection and Prevention

### At-Review Time

- Code review must check: *"If this refactor changes or removes a function call, have I verified that all callers of this function (including documented options and type signatures) have been updated?"*
- For options-accepting functions: *"If I'm extracting behavior into a standalone function, does the new function accept all the options/callbacks the old function did? If not, where are they forwarded?"*

### Automated (Testing)

- **Type tests**: If a callback option exists in the type, write a test that passes a callback and asserts it was invoked. (This is not a normal unit test; it's a contract test.)
- **Documentation tests**: Generate test cases from code examples in JSDoc comments and documentation. A failing example is a hard signal.

### Architectural

- **Single source of truth**: Type definitions should be generated from implementation or vice versa, not manually maintained in parallel.
- **Documentation automation**: Use a tool that extracts JSDoc from TypeScript and fails the build if code examples don't run.
- **Contract tests**: For every option or callback in a public API, write a test that exercises it in isolation. Passing tests mean the contract is upheld.

---

## Relation to Issue #1123

In this case, detection required:
1. A unit test that passed `onNavigate` to `initClientNavigation` and asserted it was called.
2. Manual review of the commit that changed the function (commit `c543ef7`) to notice the callback invocation was deleted.

Neither happened automatically. The issue was discovered only because the maintainer (@peterp) reviewed the issue report and looked at the implementation.

---

## Takeaway

When refactoring functions with options, callbacks, or side-effect parameters:

1. **Verify every documented option is still handled.**
2. **Write a test for each optional parameter** — even if it's optional, prove it's used when provided.
3. **Update documentation alongside code**, and ideally automate the sync.
4. **Treat optional parameters seriously** — don't assume they can be safely deleted without a test catching it.
