# 2025-10-02: Investigate Client-Side Navigation Regression

## Problem

Client-side navigation, specifically for links, appears to be broken. This seems to be a regression introduced around commit `c543ef7f425720ab1677dc7fed03965bfb37334d`. The task is to investigate this commit, identify the cause of the regression, and propose a fix.

## Investigation Plan

1.  Examine the changes in commit `c543ef7f425720ab1677dc7fed03965bfb37334d`.
2.  Analyze how these changes might affect client-side link navigation.
3.  Formulate a hypothesis for the root cause.
4.  Propose a solution.

## Investigation: Commit Analysis

I examined the changes in commit `c543ef7f425720ab1677dc7fed03965bfb37334d`. The most significant changes related to client-side navigation are in `sdk/src/runtime/client/navigation.ts`.

The logic for handling link clicks was refactored into a `navigate` function. This function is responsible for updating the browser history, calling the server to fetch the RSC payload for the new route, and updating the page content.

## Hypothesis

The regression is likely caused by a typo in the `navigate` function in `sdk/src/runtime/client/navigation.ts`.

The line that is supposed to call the server to fetch the RSC payload is:

```typescript
await globalThis.__rsc_callServer as () => Promise<void>;
```

This line contains a type assertion but is missing the parentheses `()` to actually invoke the function. As a result, the client-side navigation is initiated (URL changes), but the content for the new page is never fetched from the server, and the UI does not update. The correct line should be:

```typescript
await (globalThis.__rsc_callServer as () => Promise<void>)();
```
or simply
```typescript
await globalThis.__rsc_callServer();
```

This would explain why client-side navigation appears to have stopped working - the URL changes, but nothing else happens.

## Solution

The fix is to correctly invoke `globalThis.__rsc_callServer()` in `sdk/src/runtime/client/navigation.ts`. I've changed the line:

```typescript
await globalThis.__rsc_callServer as () => Promise<void>;
```

to:

```typescript
// @ts-expect-error
await globalThis.__rsc_callServer();
```

This ensures that the server is called to fetch the RSC payload when a navigation event occurs. I've added a `@ts-expect-error` to acknowledge that `__rsc_callServer` is not part of the standard `globalThis` type definition.

## PR

**Title:** `fix(runtime): Correct function call in client-side navigation logic`

**Description:**

### Problem

[PR #804](https://github.com/redwoodjs/sdk/pull/804) introduced programmatic navigation but accidentally broke traditional link-based navigation. A line of code responsible for fetching page content from the server was changed from a function call into a statement, which meant it no longer executed. As a result, clicking a link would change the URL but not the page content.

### Solution

This change restores the line back to a function call. An end-to-end test has been added to cover link-based navigation and prevent this from happening again.
