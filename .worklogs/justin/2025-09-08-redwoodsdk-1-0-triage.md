# Work Log: 2025-09-08 - RedwoodSDK 1.0 Triage Session

## Plan / Agenda

**DEADLINE PRESSURE: 1.0-beta has a very short timeline. We must be RUTHLESS.**

The goal of this session is to triage tasks for the RedwoodSDK 1.0-beta and 1.0 releases. The primary lens for every decision is **perceived stability**: does this task undermine the feeling that RedwoodSDK is stable to use in dev or production? 

**Core principle: "Good enough" beats perfect. We don't have time or resources for comprehensive solutions. Lightweight, bare minimum fixes that solve the core problem.**

### Release Criteria

- **What "critical stability" means (1.0-beta):**
    - Dev, build, HMR, and deploy workflows cannot hang, crash, or behave unpredictably.
    - Workflows must be smooth for common usage paths (create project, add route, run migrations, deploy).
    - Errors must be clear and actionable. Obscure or misleading errors are blockers because they erode confidence.
    - 1.0-beta must feel usable day-to-day without show-stoppers.

- **What "feels stable" means (1.0):**
    - All 1.0-beta criteria.
    - No critical CVEs impacting users.
    - No known rough edges that undermine perceived stability in dev/prod workflows.
    - 1.0 should feel polished and confidence-inspiring for new users.

### Labels (Milestones)

These are both labels AND milestones - they determine when work gets done:

- **`1.0-beta`**: BLOCKING the beta release. Must be fixed or beta can't ship. Bare minimum fixes only.
- **`1.0`**: Must be fixed before 1.0 release, but not beta-blocking. Good enough solutions.
- **`1.x`**: Nice-to-have, safe for minors after 1.0. Can wait.
- **`future`**: Exploratory, feature work, performance monitoring. Not urgent.
- **`experimental`**: Issues around db, unbundled deps, inline entrypoints, route HMR, CSS in RSC, Vitest, perf checks — not yet stable/contracted. Can break.

### Triage Process
We will triage across three kinds of inputs: GitHub issues, user to-do list items, and missing tasks (gap-finding). For each input, we will assign a label and provide a clear description and rationale, defaulting to `1.x` if uncertain.

## Context

This section captures the initial context provided for the triage session.

### Core Challenges
- **The Chicken-and-Egg Problem:** RedwoodSDK lacks broad production usage, where unknown unknowns are typically discovered. However, users won't adopt it until it feels production-ready. We must ground our definition of "stable" in developer perception to break this cycle.

### Key User Pain Points

- **Third-Party Library Compatibility:** Users experience significant friction when using their favorite libraries, particularly component libraries like **ShadCN** and **Base UI**. Issues often arise from stylesheet inclusion and the heavy use of `"use client"` directives. Compatibility issues also surface with other libraries like **Resend**, often due to dependencies that are incompatible with React Server Components (e.g., `react-dom/server`). The general theme is that developers migrating from ecosystems like Next.js expect common libraries to work without significant hurdles.
- **SSR-related Dev Server Instability:** Errors during Server-Side Rendering (SSR) are a major source of instability. These errors can cause the dev server to hang, breaking HMR and forcing a manual restart.
- **Cryptic Error Messages:** When SSR-related crashes occur, the error output is often swallowed, resulting in blank or `undefined` errors. This provides no actionable information for debugging. More broadly, many error messages are terse and could be improved by providing suggestions and links to documentation, especially for common RSC-related issues.
- **Lack of CVE Monitoring:** There is currently no formal process for monitoring or addressing CVEs in project dependencies.

## Sources

### User To-Do List Items

*Items from Justin's personal to-do list that need triage*

#### Focus
- investigate chakra demo (Discord thread: https://discord.com/channels/679514959968993311/1412270477744934942 - user vince-roy having React2.createContext issues with Chakra UI, similar to Radix issues)
- windows paths fixes for scanner (Windows ESM URL scheme error from Marius Walin's students - works on Mac/Linux, breaks on Windows with 0.2.0+. Related to directive scanner: https://github.com/redwoodjs/sdk/blob/main/docs/architecture/directiveScanningAndResolution.md)

#### Important  
- (empty)

#### Unblock
- (empty)

#### Non-deep
- update passkey addon to not use deprecated headers api
- check use client caching during HMR fixed
- say hi with context in kysely discord (where tho?)
- read https://github.com/redwoodjs/sdk/pull/605#issuecomment-3110066490

#### Maintain
- fix style smoke test flakiness

#### Next
- catch and fix ssr errors causing never ending loading (SAME AS: Dev server hangs from I/O context issues - GitHub #468)
- upgrade react deps
- use latest canary for react in starters
- investigate Marius layout context issue (Context providers in layouts work for SSR but not client-side in dev - double-eval of modules causing provider/consumer mismatch. Discord thread shows workaround but core issue needs fixing)
- investigate machinen response thing
- rwsdk w/ vitest
- rwsdk/db log for migrations on dev
- Upgrade react to try fix id problem
- fix react/react-compiler import issue
- test out usage with react-compiler
- figure out why not seeing node modules "use client" in redwoodui project and fix
- error and docs for ssr errors
- upgrade to vite 7
- actually finish capbase invite flow
- migration control for rwsdk/db

#### 1.0
- perf checks in CI?
- rwsdk/db used and we're happy with it
- route hmr?
- help messages in errors?
- css in server components?
- unbundle deps
- remove deprecated APIs (e.g. headers)
- there's no APIs we want to still settle? (e.g. client nav integrating with initClient)

#### Document
- document that we dont pass props to client components

#### Backlog
- worker run path
- discuss with Peter:: more seamless client nav api integration
- support css modules with server
- remove need for manual client entry points
- rwsdk/db log for migrations on deploy
- support inlining entry point

## Sources

### Current GitHub Issues

*Fetched 2025-01-09 - 57 open issues*

---

#### Issue #677: dev mode broken when using naming files *.client.tsx in ^0.3.0

**Description:**
after updating to 0.3.0 onwards there is an issue with having file names *.client.tsx

Error: (ssr) No module found for '/src/app/pages/Button.client.tsx' in module lookup for "use client" directive
    at /__ssr_bridge/virtual:rwsdk:ssr:rwsdk/__ssr_bridge:165:11
    at /__ssr_bridge/virtual:rwsdk:ssr:rwsdk/__ssr_bridge:176:18

steps to reproduce get latest version with
`npx create-rwsdk my-project-name`

- create Button.client.tsx file with use client directive
- import said file into Home.tsx
- run 'pnpm dev'
- visit localhost:5173

After saving file error goes away this only happens on initial load.

I personally worked around this just by changing naming convention

---

#### Issue #674: Route with renderToStream not working as expected

**Description:**
I'm trying to figure out how to get responses with a chunked transfer encoding using RedwoodSDK but I'm running into an error when I try to do so.

I have a very basic app with a "normal" route and a streamed route that I pretty much copied from the [kitchen sink example](https://github.com/redwoodjs/kitchensink/blob/220ca3e51a529d99f8259e65b6f2c541812e103d/src/app/pages/nav/routes.tsx#L42-L55):

```typescript
import { defineApp, renderToStream } from "rwsdk/worker";
import { route, render } from "rwsdk/router";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { setupSessionStore } from "./session/store";
import { Session } from "./session/durableObject";
import { env } from "cloudflare:workers";
export { SessionDurableObject } from "./session/durableObject";

export type AppContext = {
  session: Session | null;
};

export default defineApp([
  setCommonHeaders(),
  async () => {
    setupSessionStore(env);
  },
  render(Document, [route("/", () => <h1>Not streamed</h1>)]),
  route("/stream", async () => {
    const stream = await renderToStream(
      <div>
        <h1>Streamed route</h1>
        <p>This should be a chunked response</p>
      </div>,
      { Document }
    );
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }),
]);
```

When I load the stream route in the browser, the contents briefly flash but then vanish and there's a 'Connection closed' error in the browser console:

https://github.com/user-attachments/assets/587602b7-4821-4868-a475-76dc21b8597d

I get the same behaviour locally and on Cloudflare workers.

---

#### Issue #667: Prefix params not passed down to routes

**Current Labels:** bug

**Description:**
To be confirmed.
```
// /tasks/routes.tsx
export const taskRoutes = [route("/", [waitForContainer, TaskDetailPage])];

// worker.tsx
 prefix("/tasks/:containerId", [
        ...taskRoutes,
]),
```

---

#### Issue #656: Proposal: Expose React 19 Error Handling APIs in RedwoodSDK

**Description:**
## Background

React 19 introduced powerful error handling APIs (`onUncaughtError` and `onCaughtError`) that enable developers to catch and handle errors at the React root level. These APIs are available in both `createRoot` and `hydrateRoot` functions, providing comprehensive error monitoring capabilities for client-side React applications.

_Credit: This proposal was inspired by Abhijeet Prasad's excellent talk on React error handling at React Miami. [Video](https://www.youtube.com/watch?v=7s__88kCBa8) | GitHub: @abhiprasad_

## Current State

The RedwoodSDK currently uses `hydrateRoot` in `src/runtime/client.tsx` but doesn't expose React 19's error handling options to developers:

```tsx
hydrateRoot(rootEl, <Content />);
```

While the SDK has server-side error handling through the router's `onError` callback, there's no way for developers to handle client-side React errors systematically.

## Problem Statement

Developers using RedwoodSDK cannot:

- Effectively monitor React errors in production
- Send client-side errors to observability services (Sentry, DataDog, etc.)
- Implement custom error recovery strategies
- Track error patterns and user impact
- Handle errors that escape React error boundaries

This limits the SDK's production readiness and developer experience for real-world applications.

## Proposed Solution

Expose React 19's error handling APIs through the existing `initClient` function, allowing developers to configure error handling at the application level.

### Option 1: Direct Parameters (Recommended)

Extend `initClient` to accept error handling callbacks directly:

```tsx
import { initClient } from "rwsdk/client";

initClient({
  transport: fetchTransport,
  onUncaughtError: (error, errorInfo) => {
    // Handle uncaught errors (e.g., async errors, event handler errors)
    console.error("Uncaught error:", error, errorInfo);
    // Send to monitoring service
    sendToSentry(error, { ...errorInfo, type: "uncaught" });
  },
  onCaughtError: (error, errorInfo) => {
    // Handle errors caught by error boundaries
    console.error("Caught error:", error, errorInfo);
    // Send to monitoring service
    sendToSentry(error, { ...errorInfo, type: "caught" });
  },
});
```

**Pros:**

- Consistent with existing API patterns
- Easy to discover and use
- Maintains backward compatibility
- Clean TypeScript integration

**Cons:**

- Adds more parameters to `initClient`

### Option 2: Grouped Configuration Object

Group error handling options in a dedicated configuration object:

```tsx
import { initClient } from "rwsdk/client";

initClient({
  transport: fetchTransport,
  errorHandling: {
    onUncaughtError: (error, errorInfo) => {
      // Handle uncaught errors
      sendToMonitoring(error, errorInfo, "uncaught");
    },
    onCaughtError: (error, errorInfo) => {
      // Handle caught errors
      sendToMonitoring(error, errorInfo, "caught");
    },
  },
});
```

**Pros:**

- Groups related functionality
- Easier to extend with additional error handling options
- Cleaner API surface
- Better organization for complex configurations

**Cons:**

- Slight API change from current patterns
- Additional nesting level

## Implementation Details

### TypeScript Types

```tsx
export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: React.Component | null;
  errorBoundaryStack?: string | null;
}

export type ErrorCallback = (error: unknown, errorInfo: ErrorInfo) => void;

// Option 1 types
export interface InitClientOptions {
  transport?: Transport;
  onUncaughtError?: ErrorCallback;
  onCaughtError?: ErrorCallback;
}

// Option 2 types
export interface ErrorHandlingOptions {
  onUncaughtError?: ErrorCallback;
  onCaughtError?: ErrorCallback;
}

export interface InitClientOptions {
  transport?: Transport;
  errorHandling?: ErrorHandlingOptions;
}
```

### Implementation Changes

The implementation would modify `src/runtime/client.tsx` to:

1. Accept the new error handling options in `initClient`
2. Pass these options to the `hydrateRoot` call
3. Maintain backward compatibility by making all options optional

```tsx
// Option 1 implementation
export const initClient = async ({
  transport = fetchTransport,
  onUncaughtError,
  onCaughtError,
}: InitClientOptions = {}) => {
  // ... existing code ...

  const hydrateOptions = {
    ...(onUncaughtError && { onUncaughtError }),
    ...(onCaughtError && { onCaughtError }),
  };

  hydrateRoot(rootEl, <Content />, hydrateOptions);

  // ... rest of implementation
};
```

## Benefits

### For Developers

- **Production monitoring**: Track React errors in real-world usage
- **Better debugging**: Get detailed error information with component stacks
- **User experience**: Implement graceful error recovery strategies
- **Business intelligence**: Understand error patterns and user impact

### For the SDK

- **Production readiness**: Essential feature for serious applications
- **Developer experience**: Aligns with modern React best practices
- **Competitive advantage**: Leverages cutting-edge React 19 features
- **Ecosystem integration**: Easy integration with error monitoring services

## Error Handling Scope

These APIs handle **client-side errors only**:

- ✅ Component rendering errors (post-hydration)
- ✅ Event handler errors
- ✅ Async operation errors in components
- ✅ Errors that escape error boundaries

They do **not** handle:

- ❌ Server-side RSC rendering errors
- ❌ Router-level errors (already handled by existing `onError`)
- ❌ SSR errors
- ❌ Network request errors (unless in React components)

## Usage Examples

### Basic Error Logging

```tsx
initClient({
  onUncaughtError: (error, errorInfo) => {
    console.error("React uncaught error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  },
});
```

### Integration with Sentry

```tsx
import * as Sentry from "@sentry/browser";

initClient({
  onUncaughtError: (error, errorInfo) => {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
          errorBoundary: errorInfo.errorBoundary?.constructor.name,
        },
      },
      tags: { errorType: "uncaught" },
    });
  },
  onCaughtError: (error, errorInfo) => {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
          errorBoundary: errorInfo.errorBoundary?.constructor.name,
        },
      },
      tags: { errorType: "caught" },
    });
  },
});
```

### Custom Error Recovery

```tsx
initClient({
  onUncaughtError: (error, errorInfo) => {
    // Log error
    logError(error, errorInfo);

    // Show user-friendly message
    showErrorToast("Something went wrong. Please try again.");

    // Optionally reload the page for critical errors
    if (isCriticalError(error)) {
      window.location.reload();
    }
  },
});
```

## Breaking Changes

None. All proposed changes are additive and maintain backward compatibility:

- New parameters are optional
- Existing `initClient()` calls continue to work unchanged
- Default behavior remains the same

## Conclusion

Exposing React 19's error handling APIs would significantly enhance the RedwoodSDK's production readiness and developer experience. The proposed solutions maintain backward compatibility while providing powerful error monitoring capabilities that are essential for modern web applications.

This feature would position the RedwoodSDK as a forward-thinking framework that leverages the latest React capabilities to provide developers with the tools they need to build robust, monitorable applications.

---

#### Issue #651: Allow specifying http method in route definition

**Description:**
I'm exploring using rwsdk not only for fullstack routes with RSC, but also to host additional RESTful resources. I'm evaluating how general‑purpose the router is compared to something like Hono or Express. Right now it looks like the route function doesn't let me specify an HTTP method, and the method isn't attached to the RouteDefinition. This makes:
- implementing RESTful endpoints cumbersome as I have to conditionally handle the http method in the request handler
- generating OpenAPI specs from middleware/validators tricky, since Hono/Express routing patterns often rely on method-aware handlers with attached openapi metadata, see e.g. https://github.com/rhinobase/hono-openapi.

Is expanding the router to support method-specific routing, i.e. attaching the method to the `RouteDefinition`, something that would be considered in scope for this project?

---

#### Issue #650: ⭐ Love RedwoodSDK? Help Us Grow by Starring the Repo!

**Description:**
Hey RedwoodSDK friends! 🌲

If you've been enjoying **[RedwoodSDK](https://github.com/redwoodjs/sdk)** — building React apps on Cloudflare with SSR, React Server Components, server functions, streaming, and realtime - we'd love your help getting the word out.

---

## ⭐ Why Stars Matter
Starring a repo on GitHub:
- Helps more developers discover RedwoodSDK
- Signals community interest to contributors and the Cloudflare ecosystem
- Gives us momentum to keep building faster

---

## ✅ How You Can Help
1. **Star the repo** — click the ⭐ at the top right of the page.
2. Share RedwoodSDK with a friend, teammate, or community.
3. Tell us about your experience — what's working great, and what could be better.

---

📚 **Docs:** [https://docs.rwsdk.com](https://docs.rwsdk.com)  
🌐 **Website:** [https://rwsdk.com](https://rwsdk.com)  
💬 **Discord:** [https://discord.gg/redwoodjs](https://discord.gg/redwoodjs)

---

Thank you for being part of the journey — your support means everything! ❤️

---

#### Issue #641: [feature request] Client-side observer for realtime connection state

**Description:**
Realtime clients can take some time to connect, or they may become disconnected.

When this happens it would be nice to have a way to show users that they are disconnected, and disable any actions which require a working connection.

E.g example below of connecting from a cold-start.

<img width="1373" height="731" alt="Image" src="https://github.com/user-attachments/assets/0cd8cca4-d8e2-42a6-9094-9a1a094d53b7" />

https://github.com/jldec/agents-chat/pull/63 is an attempt to detect connection status by pinging a server function, but I don't like the side effects (on other clients) of doing this and it introduces an additional client component.

I would prefer to have a useRealtimeStatus hook which returns the websocket status or maybe the websocket itself.

---

#### Issue #639: Docs: `bash frame="none"` prefix doesnt work

**Description:**
In the [docs](https://docs.rwsdk.com/getting-started/first-project/#local-development), the suggestion is made to prefix dev/deploy commands with `bash frame="none"` which yields:

```
bash: frame=none: No such file or directory
```

from both a zsh and bash shell. 

Was wondering what the rational is behind this suggestion and whether we can remove it?

---

#### Issue #635: Client components importing Prisma enums cause cryptic WASM build errors

**Description:**
When client components import Prisma enums (the exported `const`, not the `type`) from the main `@generated/prisma` module, the build fails with a cryptic WASM error that doesn't explain the root cause or solution:

```
[vite:wasm-fallback] Could not load <project dir>/node_modules/.pnpm/@prisma+client@6.8.2_prisma@6.8.2_typescript@5.8.3__typescript@5.8.3/node_modules/@prisma/client/runtime/
query_engine_bg.sqlite.wasm (imported by generated/prisma/internal/class.ts): "ESM integration proposal for Wasm"
is not supported currently. Use vite-plugin-wasm or other community plugins to handle this. Alternatively, you can use
`.wasm?init` or `.wasm?url`. See https://vite.dev/guide/features.html#webassembly for more details.
```

I figured it out: I have to do something like this

```
import { FeedLifeStage } from "@generated/prisma/enums";
import { Organization } from "@generated/prisma";
```

instead of `import { FeedLifeStage, Organization } from "@generated/prisma";`. But only for client components; it's not required for server components!

So...well and good. I'm not so sure this is a Redwood problem per se. But I did lose a fair amount of time figuring this out, and it kinda screams "footgun" because I can get all the way to `pnpm run release` without realizing what's wrong, and then not really getting an obvious lead from the error.

Any thoughts or ideas here?

---

#### Issue #632: React7.createContext is not a function

**Description:**
Similar to #431, I'm also encountering a similar issue, but with [Radix Themes](https://www.radix-ui.com/themes/docs/overview/getting-started) instead.

Whenever I wrap the main provider of Radix Themes, I get the `React7.createContext is not a function` error. I tried wrapping in the document, in a specific page or in a [layout](https://docs.rwsdk.com/guides/frontend/layouts/).

I also created a separated `providers.tsx` component with `use client` at the top, but that didn't make a difference (which should not be needed as Radix-Themes includes already the `use client` directive).

<img width="1766" height="494" alt="Image" src="https://github.com/user-attachments/assets/11662da6-9e85-4292-ab04-7917f784e8b2" />

Any guidances would be hugely appreciated - I'm working in a POC for a internal project at [WorkOS](https://workos.com), so fixing this would be huge appreciated to move this POC forward.

---

#### Issue #627: Support inlining client entry point in Document

**Current Labels:** bug

**Description:**
When the document contains `initClient` you get the following error:
```
Uncaught error:  Error: An unsupported type was passed to use(): undefined
```

---

#### Issue #624: Suggest "use client" wrapper when `react-dom/server` imported

**Description:**
Use case: if one uses a library that uses `react-dom/server` (directly or transitively), they'll get a `react-dom/server is not supported in React Server Components` and not know why or what to do about it.

We can identify these cases, and suggest wrapping the usage in a `use client`, where on server side `react-dom/server` runtime can be used.

## Links
* Resend usage: https://discord.com/channels/679514959968993311/1373685754957660283/1400222778216681482
* Discussion where this suggestion was made: https://discord.com/channels/679514959968993311/1400208423836188774/1400224672615890984 (thanks @nickbalestra!)

---

#### Issue #619: Support usage with vitest (or communicate that we do not)

**Description:**
In order for RedwoodSDK to be usable with vitest, we'd need to make vitest RSC aware, including:
* Usage with RSC react runtimes
* How to understand`"use client"` and `"use server"`
* Integration/compatibility with [CF vitest plugin](https://developers.cloudflare.com/workers/testing/vitest-integration/)

Either this, or we need to catch and communicate that we do not support this at the moment - at runtime and in docs.

---

#### Issue #618: Add logging for when server actions imported but do not have "use server"

**Description:**
It is easy enough to run into a situation where one has `"use client"` module importing server actions, where those server actions do not yet have `"use server"` directives. When this happens, it can be difficult to tell what is broken, where, and why.

Ideally we could catch errors like these, and suggest adding missing `"use server"` directives as a possible solution.

## Links
Discussion: https://discord.com/channels/679514959968993311/1369426240385056849/1399312017877368979

---

#### Issue #617: Support CSS modules in server components

**Description:**
Hi, there! Given Redwood is using Vite - that comes with an out-of-the-box setup for CSS modules - I'd expected CSS modules to work straight away too.

I'm running into two issues right now:
1. CSS module imports aren't recognized by TS (easy fix by adding them to `vite.d.ts`)
2. For the CSS modules to be properly processed by Vite, I have to add the `'use client'` directive to each file - regardless of if they're actual client or server components.

I did find the Tailwind & ShadCN tutorials in the docs, but nothing is mentioned about other more lightweight approaches.

---

#### Issue #580: Fullstack tutorial: Field name difference in `ApplicationForm` vs `EditApplicationForm`

**Description:**
When following the tutorial, a hard to debug error will occur after [setting-up-the-edit-page-and-components](https://docs.rwsdk.com/tutorial/full-stack-app/jobs-details/#setting-up-the-edit-page-and-components).

The tutorial instructs:

```
For the form, I'm going to duplicate the src/app/components/ApplicationsForm.tsx file and name the new file EditApplicationForm.tsx.
```

However when doing this, the name of the `Select` is: `<Select name="status">`
But in the following instructions creating the server function in `updateApplication`, the `id` refers to `formData.get("statusId")`.
 

The tutorial does not mention to update the name of the select, it just uses the updated name in a snippet:

```jsx
<Select
  name="statusId"
  defaultValue={application?.status?.id.toString() ?? ""}
>
```

Since the new name is not mentioned, it's easy to miss and get strange errors later when trying to update an application.

The root cause of this would be best fixed if both `EditApplicationForm` and `ApplicationForm` have the same name for the `Select`, so the duplication of `ApplicationsForm` will work without errors.

---

#### Issue #579: Fullstack tutorial: Typescript error in `Edit.tsx`

**Description:**
When following the tutorial in step, a Typescript error occurs in the `Edit.tsx` file.
Step [loading-the-application-from-the-database](https://docs.rwsdk.com/tutorial/full-stack-app/jobs-details/#loading-the-application-from-the-database) uses a `findUnique` prisma query, which does not guarantee a match, and `application` might be `null`.

This causes a ts error here:

```tsx
<EditApplicationForm application={application} statuses={statuses} />
```

Because `EditApplicationForm` has the following props:

```tsx
  statuses,
  application,
}: {
  statuses: ApplicationStatus[];
  application: ApplicationWithRelations;
}) {
```

This error is also present in the [final code](https://github.com/redwoodjs/applywize/blob/main/finished/src/app/pages/applications/Edit.tsx), but not mentioned in the tutorial.

A quick 

```tsx
  if (!application) {
    throw new Error("Application not found");
  }
```

would at least make it go away. The tutorial should mention the error and, ideally, propose a fix, even if it's a quick one.

---

#### Issue #570: Suspense fallback not triggered during client navigation RSC payload rehydration

**Description:**
When using client navigation that triggers server component data refresh, the RSC payload streams correctly but Suspense boundaries do not show their fallback UI during the rehydration process.

---

#### Issue #569: initClient fails when loading 'new Response(await renderToStream(< />, { Document })'

**Description:**
I think there are missing RSC headers or something like that when you return a `renderToStream()` document in the response, instead of letting the router handle it. This happens for status 200 as well (not just status 404).

#### Repro
- git clone https://github.com/jldec/agents-chat
- git checkout 56a5dcaa
- modify client.tsx not to ignore pages with element id '404'
  e.g.   `if (!document.getElementById('404_IS_NOT_THE_ID_')) {`
- pnpm install, pnpn dev
- navigate to an unknown path e.g. http://localhost:5173/foo

```
Uncaught error:  Error: An unsupported type was passed to use(): undefined
```

<img width="1135" height="782" alt="Image" src="https://github.com/user-attachments/assets/becbee13-9b3a-4c11-adcf-8546ed2c8f1d" />

<img width="1133" height="790" alt="Image" src="https://github.com/user-attachments/assets/8003dcf5-510c-40c4-a5e8-ffac6f641919" />

---

#### Issue #568: Support setting response.status from middleware

**Description:**
This is related to #498 

I use [middleware](https://github.com/jldec/agents-chat/blob/f1d94eeb60d8bf75b8a95cf21961cbb5baf45710/src/worker.tsx#L41) and a [catch-all theme](https://github.com/jldec/agents-chat/blob/f1d94eeb60d8bf75b8a95cf21961cbb5baf45710/src/worker.tsx#L63) on route `*` for content from a CMS.

When there are errors or the route is not found in the middleware, I'd like to set the response.status in middleware, and then pass control to the theme to render a nice 50x or 404 response page.

The solution may look similar to setting reponse headers via [requestInfo.headers](https://docs.rwsdk.com/core/routing/#request-info).

```ts
requestsInfo.responseStatus = 500
```

Similar to https://hono.dev/docs/api/context#status

maybe deprecate `requestInfo.headers` and rename it to `requestInfo.responseHeaders` as well

---

#### Issue #566: Communicate that we only support stylesheet urls

**Description:**
Vite's approach is to start at an html entry point file and figure out what stylesheet imports are in what js files, and compute the styles bundles that way.

We don't support this, but we do support importing the stylesheet urls in the server component code, and putting the resulting urls in your document.

When users import stylesheets in client components, we need to communicate that we don't support this pattern, and suggest what we do support.

Initially discussed on discord with @mariuswallin

---

#### Issue #564: "Error Rendering RSC to HTML stream."

**Description:**
![Image](https://github.com/user-attachments/assets/be19038e-54b6-48af-b205-e6878cb8dfd2)

Waiting for more context...

## Discussion

- We initially formatted proposed issues with just a title, label, and rationale.
- We decided to add a `Description` field to each proposed issue to provide necessary context for what the problem is, separate from the rationale of why it's being prioritized.
- The issue of server instability and swallowed errors are being kept together, as the swallowed errors are a primary contributor to the instability and the poor developer experience.

---

#### Issue #555: automatically append "/" to end of routes.

**Current Labels:** bug

**Description:**
*No description provided*

---

#### Issue #552: Allow "userspace" to overwrite the Request object in RSC network requests.

**Description:**
We're using the RSC mechanism in order to handle client-side navigation. To make this feel buttery smooth, we can introduce pre-fetch mechanisms that will fetch a page first, cache it in the browser, and then use that cache on subsequent requests.

However, RSC actions invokes a POST request, in order to facilitate caching, we need to use a GET request.

---

#### Issue #529: suggestion: use recent compatibility date in wrangler.json for the starters

**Description:**
https://github.com/redwoodjs/sdk/blob/94b3c402aca296a6995a0d5ded29f6fc9391bbbb/starters/standard/wrangler.jsonc#L5
https://github.com/redwoodjs/sdk/blob/94b3c402aca296a6995a0d5ded29f6fc9391bbbb/starters/minimal/wrangler.jsonc#L12

the old dates can cause errors like this one [here](https://github.com/jldec/agents-chat/pull/27#issuecomment-2983298779)

---

#### Issue #500: Tutorial: Dark / light mode

**Current Labels:** documentation

**Description:**
*No description provided*

---

#### Issue #498: Support handling errors thrown from action handlers

**Description:**
Currently there is no way to catch errors thrown from action handlers (aka server functions).

## API
We've settled on this design:

```tsx
export default defineApp([
  // other middleware
  () => ...,
  () => ...,

  // ...
  render(Document, [
    route("/", ...),
  ]),
 
  // >> catch all errors from above
  except((error) => {
    console.log(error);
    return new Response(null, { status: 500 });
  })
])
```

## Links
Related discussion: https://discord.com/channels/679514959968993311/1381128906341613628/1381290036837748869

---

#### Issue #495: Using Cloudflare Agents

**Description:**
Hi Guys!

Thanks for the awesome setup RedwoodJS is.

I'm trying to get some Cloudflare Agents running in my project, but failing for now.

See https://developers.cloudflare.com/agents/api-reference/agents-api/#useagent for what I'm trying to use.

I encounter 2 issues. 

1 - For some reason wrangler does not respond to the websocket request.
Maybe it does not start the server internally. Maybe the DataSync class is not visible to Wrangler because of redwoodJS taking over the default ExportedHandler ?

2 - This is a second issue, when including the ```import { useAgentChat } from "agents/ai-react";``` the build fails. It's an incompatibilty in with the "SWR" package. The default export could not be resolved. I think it has something to do with the blended server + client nature of redwoodjs?

Thanks. Below are the main changes I made to get agents to work. Basically what I am trying is to get the official agents starter https://github.com/cloudflare/agents-starter to work within redwood js. Being able to integrate agents into redwoodjs ecosystem looks extremely promising to me, as it allows for building scalable UI's for AI driven processes, which to me is the future of development

Thanks again!


wrangler.jsonc
```json
  "durable_objects": {
    "bindings": [
      ...,
      {
        "name": "DATA_SYNC",
        "class_name": "DataSync"
      }
    ]
  },
```

worker.tsx
```typescript
...
export { DataSync } from "@/app/worker/datasync";
....
```

datasync.ts
```typescript
import { type Connection, Agent } from "agents";

export type AIAgentState = {
  counter: number;
  text: string;
  color: string;
};
export class DataSync extends Agent<Env, AIAgentState> {
  // Initialize with default state
  initialState = {
    counter: 0,
    text: "",
    color: "#3B82F6",
  };

  // Handle incoming messages
  async onMessage(connection: Connection, message: string) {
    try {
      console.log("Received message:", message);
      const data = JSON.parse(message);

      if (data.type === "increment") {
        console.log("Incrementing counter");
        // Set the new state
        this.setState({ ...this.state, counter: this.state.counter + 1 });
      }
    } catch (error) {
      console.error("Error processing message:", error);
      console.error("message");
      connection.send(
        JSON.stringify({
          type: "error",
          message: "Failed to process message",
        })
      );
    }
  }

  // Called when state is updated
  onStateUpdate(newState: any) {
    console.log("State updated:", newState);
  }
  // WebSocket error and disconnection (close) handling.
  // @ts-ignore
  onError(connection: Connection, error: unknown): void | Promise<void> {
    console.error(`WS error: ${error}`);
  }
  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    console.log(`WS closed: ${code} - ${reason} - wasClean: ${wasClean}`);
    connection.close();
  }
}
```

agent.tsx
```typescript
"use client";

import type { AIAgentState } from "@/app/worker/aiAgent";
// import { useAgentChat } from "agents/ai-react";
import { useAgent } from "agents/react";
import { useEffect, useState } from "react";

export function Agent() {
  const [syncedData, setSyncedData] = useState<AIAgentState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const agent = useAgent<AIAgentState>({
    agent: "data-sync",
    // name: "default",
    onStateUpdate: (newState) => setSyncedData(newState),

    onOpen: () => {
      setConnectionStatus("connected");
    },
    onClose: () => {
      setConnectionStatus("disconnected");
    },
    onError: () => {
      setConnectionStatus("error");
    },
  });

  // Function to increment the counter
  const incrementCounter = () => {
    console.log("Sending increment request");
    if (connectionStatus === "connected") {
      agent.send(
        JSON.stringify({
          type: "increment",
        })
      );
    } else {
      console.error("Cannot increment: not connected");
    }
  };

  // Log connection status changes and data updates
  useEffect(() => {
    console.log("Connection status:", connectionStatus);
  }, [connectionStatus]);

  useEffect(() => {
    console.log("Synced data updated:", syncedData);
  }, [syncedData]);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-2xl font-bold mb-4">Agent</h1>
      <p className="text-gray-600">
        This is the agent page.{" "}
        <span
          className={`font-medium ${
            connectionStatus === "connected" ? "text-green-500" : "text-red-500"
          }`}
        >
          {connectionStatus}
        </span>
      </p>

      <div className="text-center">
        <pre>{JSON.stringify(syncedData)}</pre>
      </div>

      <button
        onClick={incrementCounter}
        disabled={connectionStatus !== "connected"}
        className="px-6"
      >
        Increment Counter
      </button>
    </div>
  );
}
```

---

#### Issue #477: Shadcn-ui in Full Stack Tutorial

**Description:**
While following the tutorial I wasn't able to install the calendar component from shadcn. See https://github.com/shadcn-ui/ui/issues/7258
I was able to work around this by installing the latest `react-day-picker` and manually add the example `Calendar.tsx` from the linked issue to the components.

---

#### Issue #472: Support redirecting in action handlers

**Description:**
Currently there's no way to opt to redirect from an action handler: 

e.g.

```ts
"use server";

export const handleForm = (formData: FormData) => {
  const name = formData.get("name");
  console.log("Name is", name);

  if (!name) {
    console.log("Name is required");
    return { error: "Name is required" };
  }

  return new Response("null", {
    status: 302,
    headers: {
      Location: "/here",
    },
  });
};
```

We need to think of how to support this, and with what API.

## Things to consider when implementing
We're reaching the action handler because of a `fetch()`, so a redirect response there won't change the browser's location. It'll likely need to be a client side redirect under the hood - might have a knock on effect on the API.

## Links
@iamslowdeath running into this: https://discord.com/channels/679514959968993311/1375673499003388064

---

#### Issue #471: Incorrect "use client" transform for inlined functions

**Description:**
This:

```ts
"use client"

function Stars({ level }: { level: number }) {
  const renderStars = (level: number) => {
    const stars = []
    for (let i = 0; i < level; i++) {
      stars.push(<Star key={`full-${i}`}  />)
    }
    return stars
  }
  return renderStars(level)
}
```

Results in an error that `renderStarsSSR` is not defined

This is very likely because of a bug in our use client transformation plugin - the transformations we do is probably picking up the inlined function and incorrectly doing transforms on it.

## Links
* @iamslowdeath running into the issue: https://discord.com/channels/679514959968993311/1375746461404500018

---

#### Issue #470: Use project vite config for seed.ts

**Description:**
Currently worker scripts (used for seed.ts) defines its own vite config, rather than relying on the users own vite config. This means if there is anything the user needs to configure in vite for their `seed.ts` to work, they don't have a way to configure vite to workt hat way.

We need to change worker scripts to use the project's own `vite.config.mts` instead.

## Links
* @dthyresson running into this issue: https://discord.com/channels/679514959968993311/1375235770993868881/1376271202250788874

---

#### Issue #468: Bug Report: Dev Server Hangs from I/O Context Issues in Cloudflare Workers

**Description:**
I'm running into consistent issues where the RedwoodSDK dev server hangs when using server actions and realtime features in a Cloudflare Workers environment (via Miniflare). The problem seems related to ReadableStream reuse and I/O context violations, leading to unresolvable promises and stream locking errors.

## Environment

* **RedwoodSDK**: v0.0.85
* **Runtime**: Cloudflare Workers (Miniflare in dev)
* **Node**: 20.15.1
* **Package Manager**: pnpm


## Issues

* Server actions hang indefinitely and never return a response
* ReadableStreams trigger "already locked" or "I/O from a different request" errors
* Realtime hooks (`useRealtime`) consistently fail in development
* Dev server becomes unresponsive and requires restart

### Example Error

```
Cannot perform I/O on behalf of a different request...
ReadableStreamDefaultReader constructor can only accept readable streams that are not yet locked...
```

## Workarounds

* Mocking all server actions and disabling realtime features in dev mode resolves the issue
* Adding timeouts has no effect — the failure seems to happen before app code runs

## Request

It looks like RSC-related code may be sharing or persisting I/O objects between requests, which Cloudflare Workers doesn't allow. A fix that ensures request-bound isolation of streams and promises would really help improve dev stability.

---

#### Issue #464: Surface clientId for realtime

**Description:**
We currently generate an id for each client. To allow users to identify clients in a channel, we should surface a way to get at this id.

---

#### Issue #432: Dynamic ssr: false to skip ssr rendering for some component

**Description:**
Would love to have this ability in rwsdk, similar to https://nextjs.org/docs/pages/guides/lazy-loading#with-no-ssr.

Use case: my bundle is super large (20mb) I don't want some client libraries come to worker code (as it increase worker size).

---

#### Issue #425: Support `<link href="/src/styles.css" rel="stylesheet">`

**Description:**
At the moment, in `Document`, the pattern for referencing styles and scripts must look different

```tsx
import styles from "./styles.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <link href={styles} rel="stylesheet"></link>
    </head>
    <body>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
```

A few times now, I've noticed that it seems more intuitive to people to reference styles the same way that scripts are referenced:

```tsx
export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <link href="/src/styles.css' rel="stylesheet"></link>
    </head>
    <body>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
```

---

#### Issue #406: Docs: Missing prisma migrate dev step in "Creating the Application" section of Full Stack tutorial

**Description:**
While following the "Full Stack Applications > Creating the Application" tutorial, I encountered a Prisma database error during the user authentication step.

It turned out that I needed to run `bun run migrate:dev` to apply the migrations locally. This step isn't currently mentioned in the tutorial, and adding it would help others avoid confusion or runtime errors.

---

#### Issue #405: Docs: Create a guide on how to cache

**Current Labels:** documentation

**Description:**
> Hello - testing RedwoodSDK. Concern is for pure static pages, Cloudflare workers is still invoked and there is no CDN / caching in front of workers. This impact latency and billing. Any thoughts ?

https://discord.com/channels/679514959968993311/1368150337185386607

My suggestion was to modify the headers in order to have to cached downstream. Another user suggested using KV. There's a lot of nuance and we need to provide some sort of guidance.

---

#### Issue #387: Support FormData in realtime

**Description:**
When sending actions for realtime clients, you'll get an `[Object object]` error, since we currently assume the action args are JSON-serializable (which FormData will not be).

---

#### Issue #379: Error react-server condition must be enabled in any environment

**Description:**
Tried to install the minimal starter (coudn't install the standard b/c we get a cryptic wasm.js error) and we get the following error after visiting: http://localhost:5173/

`The "react" package in this environment is not configured correctly. The "react-server" condition must be enabled in any environment that runs React Server Components. at async ProxyServer.fetch (/node_modules/.pnpm/miniflare@4.20250428.0/node_modules/miniflare/src/workers/core/proxy.worker.ts:173:11`

---

#### Issue #368: throw new Error(`Failed to resolve ${packageName}`);

**Description:**
Hello,

Very excited for the new sdk!

I am having this error when i run `yarn dev`

`🚀 Project has no .wrangler directory yet, assuming fresh install: running `npm run dev:init`...

> @redwoodjs/starter-standard@1.0.0 dev:init
> rw-scripts dev-init

file:///E:/programlama/newproject/.yarn/__virtual__/@redwoodjs-sdk-virtual-fc05f97cda/4/C:/Users/emreo/AppData/Local/Yarn/Berry/cache/@redwoodjs-sdk-npm-0.0.75-9f67d162a3-10c0.zip/node_modules/@redwoodjs/sdk/dist/vite/reactConditionsResolverPlugin.mjs:98
            throw new Error(`Failed to resolve ${packageName}`);
                  ^

Error: Failed to resolve react
    at resolveWithConditions (file:///E:/programlama/newproject/.yarn/__virtual__/@redwoodjs-sdk-virtual-fc05f97cda/4/C:/Users/emreo/AppData/Local/Yarn/Berry/cache/@redwoodjs-sdk-npm-0.0.75-9f67d162a3-10c0.zip/node_modules/@redwoodjs/sdk/dist/vite/reactConditionsResolverPlugin.mjs:98:19)
    at async generateImports (file:///E:/programlama/newproject/.yarn/__virtual__/@redwoodjs-sdk-virtual-fc05f97cda/4/C:/Users/emreo/AppData/Local/Yarn/Berry/cache/@redwoodjs-sdk-npm-0.0.75-9f67d162a3-10c0.zip/node_modules/@redwoodjs/sdk/dist/vite/reactConditionsResolverPlugin.mjs:104:28)
    at async reactConditionsResolverPlugin (file:///E:/programlama/newproject/.yarn/__virtual__/@redwoodjs-sdk-virtual-fc05f97cda/4/C:/Users/emreo/AppData/Local/Yarn/Berry/cache/@redwoodjs-sdk-npm-0.0.75-9f67d162a3-10c0.zip/node_modules/@redwoodjs/sdk/dist/vite/reactConditionsResolverPlugin.mjs:109:27)

Node.js v20.19.1`

---

#### Issue #356: Standard starter breaks when project path has __ in it

**Description:**
There's a bug in our special handling of the prisma query engine wasm, which happens when project paths have a `__` somewhere in their name.

![Image](https://github.com/user-attachments/assets/8e677fd8-54cd-4951-973c-9b8a85e3a754)

## Links
* [Discussion](https://discord.com/channels/679514959968993311/1365050460914057318/1365050622570791114)

---

#### Issue #350: (docs): Incorporate Deploy to Staging info from Blog post to Docs

**Current Labels:** documentation

**Description:**
This post: https://rwsdk.com/blog/redwoodsdk-and-cloudflare-environments "Managing Production and Staging Environments with RedwoodSDK and Cloudflare" explains how to manage and deploy to both production and staging environments.

The docs for https://docs.rwsdk.com/core/env-vars/ and https://docs.rwsdk.com/core/hosting/ could benefit from having this info as well -- especially the wrangler config and the command `CLOUDFLARE_ENV=staging pnpm release` to explain how CF detects environments.

---

#### Issue #343: Support disabling `wrangler types` generation

**Description:**
I need a way to disable redwood running `wrangler types` as part of `vite build`
```ts
export default defineConfig({
  plugins: [redwood({ types: false })],
});
```

**WHY**: I am building a `Redwood` integration to [Alchemy](https://github.com/sam-goodwin/alchemy) that replaces the need for wrangler and uses type inference instead of type generation.

In Alchemy, a Redwood site is deployed to Cloudflare like so:

```ts
const database = await D1Database("redwood-db", {
  name: "redwood-db",
  migrationsDir: "drizzle",
});

export const website = await Redwood("redwood-website", {
  bindings: {
    DB: database,
  },
});
```

This creates the D1 database, builds the redwood app, binds the database and deploys the Worker+Assets.

Then a `.env.d.ts` file is used to infer the bindings and other types from the `website` instance (instead of through code generation from the `wrangler.jsonc`)

```ts
/// <reference types="./env.d.ts" />

import type { website } from "../alchemy.run";

export type CloudFlareEnv = typeof website.Env;

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudFlareEnv {}
  }
}
```

---

#### Issue #337: Support inlined 'use server'

**Description:**
At the moment we support this:
```
'use server';

export function doThing() {
  // ...
}
```

but not this

```
export function doThing() {
  'use server';
  // ...
}
```

---

#### Issue #311: Avoid repetition for routes+links

**Description:**
From https://discord.com/channels/679514959968993311/1307974274145062912/1361442272289493002

> Adding links to the link file seemed tedious. You essentially have to define routes twice. I understand that something you return a regular response from you might not want as a link but wondering if links could be auto generated for you.

---

#### Issue #291: Check if imports in inline scripts in document are possible

**Description:**
*No description provided*

---

#### Issue #290: Mention ctx and middleware in auth docs - why it placed there, what happens on failure with throwing

**Current Labels:** documentation

**Description:**
*No description provided*

---

#### Issue #286: Better error for case where we import { Button } but export default function Button()

**Description:**
When importing a component like { Button } but exporting it as default function Button(), especially in 'use client' components, the resulting error is unclear and unhelpful. We should improve the error message to indicate that the named import does not match the default export.

---

#### Issue #285: Investigate undefined error after export changes

**Description:**
We're seeing an error in development that just shows as `undefined`, which appears to be related to changes in exports (such as switching from named to default exports).

---

#### Issue #273: Handle "h is not a function" error masking real issues

**Description:**
In dev, unhandled errors sometimes result in a vague "h is not a function" message. This usually happens when the router can't find a route — often because of an upstream error — making debugging harder. Improve the error reporting so the actual root cause isn't obscured.

---

#### Issue #271: Add smoke test script to check HTML and client response

**Description:**
Create a simple one-liner or script that performs a basic smoke test:
* Confirms client-side RSC updates is working (e.g. via some internal `__health` action)
* Verifies a valid HTML response is returned from the server

The idea is we'll use this per starter or example to catch regressions in critical paths for the sdk.

---

#### Issue #244: RedwoodSDK unstable APIs

**Current Labels:** documentation

**Description:**
## Stability Overview

This issue tracks the current stability of major features in the framework—what's solid, what's in progress, and what may need more work.

---

### ✅ Stable

#### **Rendering**
- SSR  
- React  
- React Server Components  
- React Client Components  
- Server Functions

#### **Router**
- Middleware  
- Interruptors  
- Route Handlers  
- Returning `Response` objects & Streaming responses  
- Returning JSX  

---

### 🚧 Unstable

#### **Prisma Migrations**
We've implemented a temporary workaround for Prisma migrations. A proper solution is current in a preview version of Prisma 6.6.0, stable by **end of May 2025**.

#### **Realtime**
We support three main features:
- **Changes** (via Server Functions)  
- **Presence**  
- **Broadcast**

We haven't yet run enough experiments to fully validate reliability across these features.

#### **WebAuthn**
Setup is currently more complex than we'd like. We're working on ways to simplify the process—likely through improved documentation. The UI feels a bit clunky, I think it could be improved by adding activity indicators, or something along those lines.

The user experience for SDK consumers is expected to remain the same.

---

#### Issue #206: Cursor Rules: Ship with a set of Cursor Rules for building with RedwoodSDK

**Description:**
Having seen the released [Supabase ai-editors-rules](https://supabase.com/ui/docs/ai-editors-rules/prompts) [Cursor rules for Cursor](https://docs.cursor.com/context/rules-for-ai) having these for RedwoodSDK (including some Cloudflare rules but specific to using storage or ai or DO in the sdk) would be 🔥 .

Either standalone and/or bundled with starters or available as docs.

Maybe a cli command to pull/refresh rules from GitHub repo?

---

#### Issue #197: prisma (seed): Add docs to explain how to seed from a CSV file given workers cannot access filesystem to read files

**Current Labels:** dependencies

**Description:**
The Prisma seed command runs as a worker:

```
"seed": "pnpm worker:run ./src/scripts/seed.ts"
```

This means that the scrip cannot access the filesystem to do fs reads to load, parse CSV files if you want to populate your dev database file CSV data.

Need "some way" to make it possible to seed using local data files.

However, you can have Vite help here by adding them as "assets" so the seed script can access.

Here's an approach I'm using (but there may be better ones):

```ts

import { parse } from "csv-parse/sync";

import csvContent from "../../data/data.csv?raw";

....

  // Read and parse the CSV file

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
```


The assetsInclude option in Vite's configuration allows you to specify additional file types that should be treated as assets. By default, Vite treats certain types of files like images and fonts as assets, meaning they will be copied as-is into the final build directory without being bundled as JavaScript. However, you may have other custom file types that you want to be treated in the same way. That's where assetsInclude comes in handy.


1. First add `assetsInclude` to `vite.config.mts` for csv file extensions:

```ts
export default defineConfig({
  plugins: [redwood(), tailwindcss()],
  assetsInclude: ["**/*.csv"], // <----
});
```

2. Add types to `src/types`

* csv.d.ts

```ts
declare module "*?csv" {
  const content: string;
  export default content;
}
```

* raw..d.ts

```ts
declare module "*?raw" {
  const content: string;
  export default content;
}
```


You can then import and parse a CSV file.


### Important 

Note, I'm not sure if this means the csv file is bundled in and increases app size.

Also - an alternative approach might be just to upload the csv file storage and fetch and parse/load.

---

#### Issue #196: starters: Consider adding `public` directory to starters (t least standard) to show where to store static assets like styles, images, fonts

**Description:**
While one can store images, fonts and static assets in many places, consider adding a `public` directory at the same level as `src` in the starters (at least the standard starter which may often be used).

```bash
├── package.json
├── pnpm-lock.yaml
├── prisma
│   └── schema.prisma
├── public
│   └── images
│       ├── favicon.png
│       └── logo.png
|        styles.css
```

This would change `Document` to `<link rel="stylesheet" href="/styles.css" />`

as one can reference `/` as root for all public file assets:

`<Image src={`/images/logo.png`} alt="logo" width={100} height={100} />`

This way there is consistency and developer is directed and knows where to put images, fonts, etc.


Note:

Just realized that Tailwind needed 

``` 
 <link rel="stylesheet" href="/src/styles.css" />
```

if it has

```
@import "tailwindcss";
```

---

#### Issue #141: Cron: Unable to test cron triggers using Cloudflare's `wrangler dev --test-scheduled` method

**Current Labels:** pending external dependencies

**Description:**
I started to read up on Cloudflare's cron triggers: https://developers.cloudflare.com/workers/examples/cron-trigger/ and https://developers.cloudflare.com/workers/configuration/cron-triggers/.

I setup multiple triggers per their wrangler toml config and added to worker:

```toml
[triggers]
# Schedule cron triggers:
# - At every 1, 2, 3 minutes
crons = [ "1 * * * *", "*/2 * * * *", "*/3 * * * *" ]
```

and worker:

```ts

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    console.log("cron event", event);
    // Write code for updating your API
    switch (event.cron) {
      case "1 * * * *":
        // Every one minutes
        console.log("Every one minutes");
        break;
      case "*/2 * * * *":
        // Every two minutes
        console.log("Every two minutes");
        break;
      case "*/3 * * * *":
        // Every three minutes
        console.log("Every three minutes");
        break;
    }
    console.log("cron processed");
  },
} satisfies ExportHandler<Env>;
```

Cloudlfare says you can test in local via:

```bash
npx wrangler dev --test-scheduled

curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

where you match the cron trigger.

https://developers.cloudflare.com/workers/examples/cron-trigger/#test-cron-triggers-using-wrangler

However, my app responded "Not found" when requesting the added path... also this runs on port 8787.

Would be nice to test cron in development.

## Discussion

- We initially formatted proposed issues with just a title, label, and rationale.
- We decided to add a `Description` field to each proposed issue to provide necessary context for what the problem is, separate from the rationale of why it's being prioritized.
- The issue of server instability and swallowed errors are being kept together, as the swallowed errors are a primary contributor to the instability and the poor developer experience.

## Output: Proposed Issues

This section lists the issues identified for creation. New issues are added here before being created in the issue tracker.

---

### 1. Investigate and Ensure Compatibility with Popular Component Libraries (ShadCN, Base UI)

- **Description:** Users experience friction when integrating popular component libraries like ShadCN and Base UI. The common failure points appear to be related to stylesheet inclusion and the mass use of `"use client"` directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Reasoning:** Friction with popular libraries is a primary source of perceived instability. Ensuring these libraries work smoothly is critical for making the 1.0-beta feel usable for common, real-world development scenarios.
- **Label:** `1.0-beta`

---

### 2. Address Dev Server Instability and Swallowed Errors during SSR

- **Description:** When an error occurs during server-side rendering, the dev server can hang, breaking the Hot Module Replacement (HMR) loop. The associated error messages are often swallowed, appearing as `undefined` or a blank error, which gives the developer no actionable information. This forces a manual server restart and creates a highly disruptive and frustrating debugging experience.
- **Reasoning:** A hanging dev server is a show-stopper that breaks the core development loop. This directly violates the 1.0-beta stability criteria and severely undermines developer confidence.
- **Label:** `1.0-beta`

---

### 3. Improve Error Messages with Actionable Suggestions and Links to Docs

- **Description:** Many error messages are currently terse and lack guidance. For example, when a user encounters an error about `react-dom/server` being incompatible with RSCs, we don't suggest common causes (e.g., using server-only code in a client component) or solutions. We should systematically catch common errors, provide helpful suggestions, and link to a dedicated troubleshooting section in the documentation.
- **Reasoning:** While the most critical SSR errors are a beta-blocker, a broader initiative to improve all error messages is essential for a polished 1.0. This makes the framework feel more supportive and confidence-inspiring for new users.
- **Label:** `1.0`

---

### 4. Implement Lightweight CVE Monitoring for Critical Vulnerabilities

- **Description:** The project currently lacks a lightweight, automated way to monitor for critical security vulnerabilities (CVEs) within its dependencies. This means we are not proactively identifying high-impact security risks that could affect users.
- **Reasoning:** To be considered production-ready, the framework must have a basic mechanism for flagging and addressing critical security vulnerabilities. This is a core requirement for the trust and stability promise of a 1.0 release.
- **Label:** `1.0`

---

### 5. Create Basic Stability Documentation for 1.0-beta

- **Description:** Add a simple stability page to docs clearly marking what's stable vs experimental. Basic table format: Feature | Status (Stable/Experimental) | Notes. Cover core features only - rendering, routing, server functions, realtime. No API guarantees or complex migration guides - just clear expectations.
- **Reasoning:** Users need to know what they can depend on for a beta release. A lightweight page prevents users from building on unstable foundations without requiring extensive documentation work.
- **Label:** `1.0-beta`

---

### 6. Fix Context Providers in Layouts - Client-Side Double Evaluation Issue

- **Description:** Context providers in layout components work correctly for SSR but fail on the client-side in development. Root cause is double-evaluation of modules containing context, causing provider/consumer mismatch. Affects standard RSC patterns that should work. Only occurs in dev, not in builds/releases.
- **Reasoning:** This breaks a fundamental React pattern that users expect to work. Teachers like Marius are building courses around these patterns, and students are running into this issue. Undermines confidence in the framework's RSC implementation.
- **Label:** `1.0-beta`

---

### 7. Align React Dependencies to Peer-Only Strategy

- **Description:** This is a coordinated breaking change to align our React dependency strategy with a peer-dependency model. It involves three parts: 1) Update starters to use the latest React canary packages (`react`, `react-dom`, `react-server-dom-webpack`) as explicit dependencies. 2) Change the SDK's `package.json` to list these React packages as `peerDependencies` only, removing the fallback versions. 3) Modify the `reactConditionsResolverPlugin` to resolve React *only* from the user's project.
- **Reasoning:** This breaking change gives users control over React versions, creates a cleaner architecture, and is necessary to test fixes for the critical ID hydration bugs affecting component libraries. This is a beta-blocker.
- **Label:** `1.0-beta`

---

### 8. Upgrade to Vite v7

- **Description:** Upgrade the ecosystem to Vite v7. This involves two parts: 1) Update the `vite` dependency in all starters to the latest v7 release. 2) Widen the `vite` `peerDependency` range in the SDK's `package.json` to be compatible with v7.
- **Reasoning:** This is a breaking change to keep the framework aligned with its core tooling. It must be done for the 1.0-beta release.
- **Label:** `1.0-beta`

---

### 9. Align Cloudflare Vite Plugin to Peer-Only Strategy

- **Description:** This change aligns the Cloudflare Vite plugin with our new dependency strategy. It involves two parts: 1) Update starters to use the latest `@cloudflare/vite-plugin` as an explicit dependency. 2) Change the SDK's `package.json` to list the plugin as a `peerDependency` only, removing it as a direct dependency.
- **Reasoning:** This is a breaking change for architectural consistency, giving users control over this key dependency. It must be done for the 1.0-beta release.
- **Label:** `1.0-beta`
