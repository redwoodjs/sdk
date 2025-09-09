## Output: Proposed Issues

This section lists the issues identified for creation. New issues are added here before being created in the issue tracker. Existing issues will have an issue number, but still need their labels set in the issue tracker based on the label given for it below.

---

### 1. Investigate and Ensure Compatibility with ShadCN Component Library

- **Description:** Users experience friction when integrating the ShadCN component library. The common failure points appear to be related to stylesheet inclusion and the mass use of "use client" directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Triage Notes:** Compatibility with popular component libraries is a key factor for adoption and perceived stability. This is a high-priority item for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 2. Investigate and Ensure Compatibility with Base UI Component Library

- **Description:** Users experience friction when integrating the Base UI component library. The common failure points appear to be related to stylesheet inclusion and the mass use of "use client" directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Triage Notes:** Compatibility with popular component libraries is a key factor for adoption and perceived stability. This is a high-priority item for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 3. Investigate and Ensure Compatibility with Chakra UI Component Library

- **Description:** Users experience friction when integrating the Chakra UI component library. Similar to Radix issues, users are encountering `React2.createContext` errors (see Discord thread: https://discord.com/channels/679514959968993311/1412270477744934942). The common failure points appear to be related to stylesheet inclusion and the mass use of "use client" directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Triage Notes:** Compatibility with popular component libraries is a key factor for adoption and perceived stability. This is a high-priority item for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 4. Address Dev Server Instability and Swallowed Errors during SSR

- **Description:** When an error occurs during server-side rendering, the dev server can hang, breaking the Hot Module Replacement (HMR) loop. The associated error messages are often swallowed, appearing as `undefined` or a blank error, which gives the developer no actionable information. This forces a manual server restart and creates a highly disruptive and frustrating debugging experience.
- **Triage Notes:** A stable dev server is critical for the development workflow. A hanging server with unhelpful errors is a high-priority bug that must be fixed for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 5. Improve Error Messages with Actionable Suggestions and Links to Docs

- **Description:** Many error messages are currently terse and lack guidance. For example, when a user encounters an error about `react-dom/server` being incompatible with RSCs, we don't suggest common causes (e.g., using server-only code in a client component) or solutions. We should systematically catch common errors, provide helpful suggestions, and link to a dedicated troubleshooting section in the documentation.
- **Triage Notes:** Clear and actionable error messages are essential for a good developer experience. This is an important improvement for the 1.0 release.
- **Label:** `1.0`

---

### 6. Implement Lightweight CVE Monitoring for Critical Vulnerabilities

- **Description:** The project currently lacks a lightweight, automated way to monitor for critical security vulnerabilities (CVEs) within its dependencies. This means we are not proactively identifying high-impact security risks that could affect users.
- **Triage Notes:** A process for monitoring and addressing critical security vulnerabilities is a requirement for a production-ready 1.0 release.
- **Label:** `1.0`

---

### 7. Create Basic Stability Documentation for 1.0-beta

- **Description:** Add a simple stability page to docs clearly marking what's stable vs experimental. Basic table format: Feature | Status (Stable/Experimental) | Notes. Cover core features only - rendering, routing, server functions, realtime. No API guarantees or complex migration guides - just clear expectations.
- **Triage Notes:** To ensure clear expectations for the beta, the documentation must clearly distinguish between stable and experimental features. This is a requirement for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 8. Fix Context Providers in Layouts - Client-Side Double Evaluation Issue

- **Description:** Context providers in layout components work correctly for SSR but fail on the client-side in development. Root cause is double-evaluation of modules containing context, causing provider/consumer mismatch. Affects standard RSC patterns that should work. Only occurs in dev, not in builds/releases.
- **Triage Notes:** This bug breaks a fundamental React pattern that developers expect to work. It is a high-priority fix for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 9. Align React Dependencies to Peer-Only Strategy

- **Description:** This is a coordinated breaking change to align our React dependency strategy with a peer-dependency model. It involves three parts: 1) Update starters to use the latest React canary packages (`react`, `react-dom`, `react-server-dom-webpack`) as explicit dependencies. 2) Change the SDK's `package.json` to list these React packages as `peerDependencies` only, removing the fallback versions. 3) Modify the `reactConditionsResolverPlugin` to resolve React *only* from the user's project.
- **Triage Notes:** This is a required breaking change to give users control over the React version and to address critical bugs in component libraries. It is a blocker for the 1.0-beta.
- **Label:** `1.0-beta`

---

### 10. Upgrade to Vite v7

- **Description:** Upgrade the ecosystem to Vite v7. This involves two parts: 1) Update the `vite` dependency in all starters to the latest v7 release. 2) Widen the `vite` `peerDependency` range in the SDK's `package.json` to be compatible with v7.
- **Triage Notes:** This is a required breaking change to keep the framework aligned with its core tooling. It must be done for the 1.0-beta release.
- **Label:** `1.0-beta`

---

### 11. Align Cloudflare Vite Plugin to Peer-Only Strategy

- **Description:** This change aligns the Cloudflare Vite plugin with our new dependency strategy. It involves two parts: 1) Update starters to use the latest `@cloudflare/vite-plugin` as an explicit dependency. 2) Change the SDK's `package.json` to list the plugin as a `peerDependency` only, removing it as a direct dependency.
- **Triage Notes:** This is a required breaking change for architectural consistency and must be done for the 1.0-beta release.
- **Label:** `1.0-beta`

---

### 12. Fix Flaky Style Smoke Tests in CI

- **Description:** The smoke tests for stylesheets are currently skipped in CI due to flakiness. This creates a blind spot for potential regressions in our styling pipeline. The tests need to be investigated, fixed, and re-enabled.
- **Triage Notes:** Reliable CI tests are essential for a stable 1.0 release. Fixing these flaky tests is a requirement for 1.0.
- **Label:** `1.0`

---

## Output: Triage of Existing Issues

This section lists the triage decisions for existing GitHub issues.

---

### 13. Issue #677: dev mode broken when using naming files *.client.tsx in ^0.3.0

- **Issue:** #677
- **Label:** `bug`
- **Triage Notes:** This bug affects a specific file naming convention and has a known workaround. It will be addressed in a future release post 1.0.

---

### 14. Issue #674: Route with renderToStream not working as expected

- **Issue:** #674
- **Label:** `bug`, `1.0`
- **Triage Notes:** While `renderToStream` is a public API, it is not on the critical path for most users. This will be fixed for the 1.0 release.

---

### 15. Issue #667: Prefix params not passed down to routes

- **Issue:** #667
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug breaks a core routing feature and is a high-priority fix for the 1.0-beta.

---

### 16. Issue #656: Proposal: Expose React 19 Error Handling APIs in RedwoodSDK

- **Issue:** #656
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 17. Issue #651: Allow specifying http method in route definition

- **Issue:** #651
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 18. Issue #641: [feature request] Client-side observer for realtime connection state

- **Issue:** #641
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 19. Issue #639: Docs: `bash frame="none"` prefix doesnt work

- **Issue:** #639
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** Incorrect documentation for a core command creates a poor first impression. This is a critical fix for the 1.0-beta.

---

### 20. Issue #635: Client components importing Prisma enums cause cryptic WASM build errors

- **Issue:** #635
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug produces a cryptic build error when using a core dependency (Prisma) in a common pattern. This is a high-priority fix for the 1.0-beta.

---

### 21. Issue #632: React7.createContext is not a function

- **Issue:** #632
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug prevents the use of popular component libraries, a critical compatibility issue that must be addressed for the 1.0-beta.

---

### 22. Issue #627: Support inlining client entry point in Document

- **Issue:** #627
- **Label:** `bug`, `experimental`
- **Triage Notes:** This bug affects an experimental feature and is not on the critical path for the 1.0 release.

---

### 23. Issue #624: Suggest "use client" wrapper when `react-dom/server` imported

- **Issue:** #624
- **Label:** `1.0`
- **Triage Notes:** This is an enhancement to improve error messages, making the framework easier to use. It is slated for the 1.0 release.

---

### 24. Issue #619: Support usage with vitest (or communicate that we do not)

- **Issue:** #619
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 25. Issue #618: Add logging for when server actions imported but do not have "use server"

- **Issue:** #618
- **Label:** `1.0`
- **Triage Notes:** This is an enhancement to improve error messages for a common mistake. It is slated for the 1.0 release.

---

### 26. Issue #617: Support CSS modules in server components

- **Issue:** #617
- **Label:** `experimental`
- **Triage Notes:** This bug affects an experimental feature and is not on the critical path for the 1.0 release.

---

### 27. Issue #580: Fullstack tutorial: Field name difference in `ApplicationForm` vs `EditApplicationForm`

- **Issue:** #580
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** Errors in the primary tutorial block new users and must be fixed for the 1.0-beta.

---

### 28. Issue #579: Fullstack tutorial: Typescript error in `Edit.tsx`

- **Issue:** #579
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** Errors in the primary tutorial block new users and must be fixed for the 1.0-beta.

---

### 29. Issue #570: Suspense fallback not triggered during client navigation RSC payload rehydration

- **Issue:** #570
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug breaks a fundamental React pattern and is a high-priority fix for the 1.0-beta.

---

### 30. Issue #569: initClient fails when loading 'new Response(await renderToStream(< />, { Document })'

- **Issue:** #569
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug breaks a core feature (streaming) and produces a cryptic error. It is a high-priority fix for the 1.0-beta.

---

### 31. Issue #568: Support setting response.status from middleware

- **Issue:** #568
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 32. Issue #566: Communicate that we only support stylesheet urls

- **Issue:** #566
- **Label:** `1.0`
- **Triage Notes:** This is an enhancement to improve error messages for a common point of confusion. It is slated for the 1.0 release.

---

### 33. Issue #555: automatically append "/" to end of routes.

- **Issue:** #555
- **Label:** `bug`, `1.0`
- **Triage Notes:** This bug addresses an inconsistency in router behavior and is slated for the 1.0 release.

---

### 34. Issue #552: Allow "userspace" to overwrite the Request object in RSC network requests.

- **Issue:** #552
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 35. Issue #529: suggestion: use recent compatibility date in wrangler.json for the starters

- **Issue:** #529
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug breaks a core feature (streaming) and produces a cryptic error. It is a high-priority fix for the 1.0-beta.

---

### 36. Issue #500: Tutorial: Dark / light mode

- **Issue:** #500
- **Label:** `future`
- **Triage Notes:** This is a documentation request. It will be considered for a future release post 1.0.

---

### 37. Issue #498: Support handling errors thrown from action handlers

- **Issue:** #498
- **Label:** `1.0`
- **Triage Notes:** Proper error handling for server functions is a core requirement for building stable applications. This is a key feature for a production-ready 1.0 release.

---

### 38. Issue #495: Using Cloudflare Agents

- **Issue:** #495
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** Inability to use a key Cloudflare feature is a significant compatibility bug. This is a high-priority fix for the 1.0-beta.

---

### 39. Issue #477: Shadcn-ui in Full Stack Tutorial

- **Issue:** #477
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This issue blocks users from completing the tutorial with a popular library. It is a high-priority fix for the 1.0-beta.

---

### 40. Issue #472: Support redirecting in action handlers

- **Issue:** #472
- **Label:** `1.0`
- **Triage Notes:** Redirects from server actions are a fundamental web development pattern. This feature is slated for the 1.0 release.

---

### 41. Issue #471: Incorrect "use client" transform for inlined functions

- **Issue:** #471
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This is a bug in the core `"use client"` transformation logic. It is a high-priority fix for the 1.0-beta.

---

### 42. Issue #470: Use project vite config for seed.ts

- **Issue:** #470
- **Label:** `bug`, `1.0`
- **Triage Notes:** This bug breaks a key development workflow and is slated for the 1.0 release.

---

### 43. Issue #468: Bug Report: Dev Server Hangs from I/O Context Issues in Cloudflare Workers

- **Issue:** #468
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** A hanging dev server is a show-stopper bug that breaks the core development loop. This is a high-priority fix for the 1.0-beta.

---

### 44. Issue #464: Surface clientId for realtime

- **Issue:** #464
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 45. Issue #432: Dynamic ssr: false to skip ssr rendering for some component

- **Issue:** #432
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 46. Issue #425: Support `<link href="/src/styles.css" rel="stylesheet">`

- **Issue:** #425
- **Label:** `1.0`
- **Triage Notes:** This addresses an inconsistency in how stylesheets are referenced. It is slated for the 1.0 release.

---

### 47. Issue #406: Docs: Missing prisma migrate dev step in "Creating the Application" section of Full Stack tutorial

- **Issue:** #406
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** A missing, critical command in the main tutorial is a bug that will block every new user. This must be fixed for the 1.0-beta.

---

### 48. Issue #405: Docs: Create a guide on how to cache

- **Issue:** #405
- **Label:** `future`
- **Triage Notes:** This is a documentation request. It will be considered for a future release post 1.0.

---

### 49. Issue #387: Support FormData in realtime

- **Issue:** #387
- **Label:** `future`
- **Triage Notes:** This is a limitation in an experimental feature. This will be considered for a future release post 1.0.

---

### 50. Issue #379: Error react-server condition must be enabled in any environment

- **Issue:** #379
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** A newly created project failing with a configuration error is a critical bug. This is a high-priority fix for the 1.0-beta.

---

### 51. Issue #368: throw new Error(`Failed to resolve ${packageName}`);

- **Issue:** #368
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug prevents projects from running and is a high-priority fix for the 1.0-beta.

---

### 52. Issue #356: Standard starter breaks when project path has __ in it

- **Issue:** #356
- **Label:** `bug`
- **Triage Notes:** This bug affects a specific project path structure and has a known workaround. It will be addressed in a future release post 1.0.

---

### 53. Issue #350: (docs): Incorporate Deploy to Staging info from Blog post to Docs

- **Issue:** #350
- **Label:** `future`
- **Triage Notes:** This is a documentation request. It will be considered for a future release post 1.0.

---

### 54. Issue #343: Support disabling `wrangler types` generation

- **Issue:** #343
- **Label:** `future`
- **Triage Notes:** This is a feature request. It will be considered for a future release post 1.0.

---

### 55. Issue #337: Support inlined 'use server'

- **Issue:** #337
- **Label:** `1.0`
- **Triage Notes:** Supporting the full React directive syntax is important for developer experience. This is slated for the 1.0 release.

---

### 56. Issue #311: Avoid repetition for routes+links

- **Issue:** #311
- **Label:** `future`
- **Triage Notes:** This is a developer experience enhancement. It will be considered for a future release post 1.0.

---

### 57. Issue #291: Check if imports in inline scripts in document are possible

- **Issue:** #291
- **Label:** `future`
- **Triage Notes:** This is an exploratory research task and will be considered for a future release post 1.0.

---

### 58. Issue #290: Mention ctx and middleware in auth docs - why it placed there, what happens on failure with throwing

- **Issue:** #290
- **Label:** `1.x`
- **Triage Notes:** This is a documentation request. It will be considered for a future release post 1.0.

---

### 59. Issue #286: Better error for case where we import { Button } but export default function Button()

- **Issue:** #286
- **Label:** `1.0`
- **Triage Notes:** This addresses a common source of confusion with a cryptic error message. It is slated for the 1.0 release.

---

### 60. Issue #285: Investigate undefined error after export changes

- **Issue:** #285
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** An `undefined` error provides no actionable information. This is a high-priority bug to fix for the 1.0-beta.

---

### 61. Issue #273: Handle "h is not a function" error masking real issues

- **Issue:** #273
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This vague error masks the true cause of a problem. Replacing it with a clear, actionable error is a critical fix for the 1.0-beta.

---

### 62. Issue #271: Add smoke test script to check HTML and client response

- **Issue:** #271
- **Label:** `1.0`
- **Triage Notes:** Adding smoke tests improves our ability to catch regressions. This is slated for the 1.0 release.

---

### 63. Issue #206: Cursor Rules: Ship with a set of Cursor Rules for building with RedwoodSDK

- **Issue:** #206
- **Label:** `future`
- **Triage Notes:** This is a tooling enhancement. It will be considered for a future release post 1.0.

---

### 64. Issue #197: prisma (seed): Add docs to explain how to seed from a CSV file given workers cannot access filesystem to read files

- **Issue:** #197
- **Label:** `1.0`
- **Triage Notes:** This documentation is needed to unblock a common development workflow. It is slated for the 1.0 release.

---

### 65. Issue #196: starters: Consider adding `public` directory to starters (t least standard) to show where to store static assets like styles, images, fonts

- **Issue:** #196
- **Label:** `1.0`
- **Triage Notes:** Establishing a clear convention for static assets improves the developer experience. This is slated for the 1.0 release.

---

### 66. Issue #141: Cron: Unable to test cron triggers using Cloudflare's `wrangler dev --test-scheduled` method

- **Issue:** #141
- **Label:** `bug`, `1.0`
- **Triage Notes:** The inability to test a feature locally is a bug that breaks a key development workflow. This is slated for the 1.0 release.