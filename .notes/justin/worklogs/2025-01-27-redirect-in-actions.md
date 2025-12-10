# Redirect in Actions

## Problem

Currently there's no documented way to redirect from an action handler. The issue mentions that throwing Response objects for redirects should be supported, but this needs to be:
1. Documented
2. Tested specifically for action handlers

## Plan

Create a playground example `redirect-in-actions` that demonstrates:
- Redirecting from an action handler using thrown Response objects
- Both form actions and onClick actions that redirect
- Testing that redirects work correctly in both dev and deployment environments

## Context

From the issue, it seems throwing Response objects should work for redirects in action handlers. The redirect needs to be handled client-side since actions are called via fetch(), so a redirect response won't automatically change the browser location.

## Implementation

1. Create playground example based on hello-world
2. Add action handlers that throw Response objects with redirect status codes
3. Create client components that call these actions
4. Write e2e tests (first attempt, may not pass initially)

## Findings

When an action throws a Response object:
- The exception propagates from rscActionHandler to router.handle to worker.tsx
- In worker.tsx catch block (line 275-282), if the exception is a Response, it's returned directly
- The client fetch receives this Response with status 302
- Since fetch uses `redirect: "manual"` (client.tsx line 46), redirects aren't followed automatically
- Client code needs to manually check for redirect responses and handle them

Current implementation:
- Actions throw Response objects with status 302 and Location header
- Client components catch Response exceptions and manually redirect using window.location.href
- This approach should work but may need refinement based on testing

Created:
- `playground/redirect-in-actions/` with:
  - Form action that redirects after validation (`formActionWithRedirect`)
  - onClick action that redirects (`onClickActionWithRedirect`)
  - Success page to redirect to (`/success`)
  - Client component (`RedirectDemo`) that handles Response exceptions and manually redirects
  - E2E tests covering:
    - Rendering the demo page
    - Form action redirect with name parameter
    - Form validation error handling
    - onClick action redirect

Implementation details:
- Actions throw Response objects with status 302 and Location header
- Client components catch Response exceptions and use `window.location.href` to redirect
- Success page reads URL params from RequestInfo.request
- Tests use `waitForHydration` before interactions and `poll` for assertions

