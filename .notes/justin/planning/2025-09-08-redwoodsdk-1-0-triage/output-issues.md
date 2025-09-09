## Output: Proposed Issues

This section lists the issues identified for creation. New issues are added here before being created in the issue tracker. Existing issues will have an issue number, but still need their labels set in the issue tracker based on the label given for it below.

---

### 1. Investigate and Ensure Compatibility with ShadCN Component Library

- **Description:** Users experience friction when integrating the ShadCN component library. The common failure points appear to be related to stylesheet inclusion and the mass use of "use client" directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Triage Notes:** Compatibility with popular component libraries is a key factor for adoption and perceived stability.
- **Label:** `1.0-beta`

---

### 2. Investigate and Ensure Compatibility with Base UI Component Library

- **Description:** Users experience friction when integrating the Base UI component library. The common failure points appear to be related to stylesheet inclusion and the mass use of "use client" directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Triage Notes:** Compatibility with popular component libraries is a key factor for adoption and perceived stability.
- **Label:** `1.0-beta`

---

### 3. Investigate and Ensure Compatibility with Chakra UI Component Library

- **Description:** Users experience friction when integrating the Chakra UI component library. Similar to Radix issues, users are encountering `React2.createContext` errors (see Discord thread: https://discord.com/channels/679514959968993311/1412270477744934942). The common failure points appear to be related to stylesheet inclusion and the mass use of "use client" directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Triage Notes:** Compatibility with popular component libraries is a key factor for adoption and perceived stability.
- **Label:** `1.0-beta`

---

### 4. Address Dev Server Instability and Swallowed Errors during SSR

- **Description:** When an error occurs during server-side rendering, the dev server can hang, breaking the Hot Module Replacement (HMR) loop. The associated error messages are often swallowed, appearing as `undefined` or a blank error, which gives the developer no actionable information. This forces a manual server restart and creates a highly disruptive and frustrating debugging experience.
- **Triage Notes:** A stable dev server is critical for the development workflow. A hanging server with unhelpful errors is a show-stopper bug.
- **Label:** `1.0-beta`

---

### 5. Improve Error Messages with Actionable Suggestions and Links to Docs

- **Description:** Many error messages are currently terse and lack guidance. For example, when a user encounters an error about `react-dom/server` being incompatible with RSCs, we don't suggest common causes (e.g., using server-only code in a client component) or solutions. We should systematically catch common errors, provide helpful suggestions, and link to a dedicated troubleshooting section in the documentation.
- **Triage Notes:** Clear and actionable error messages are essential for a good developer experience.
- **Label:** `1.0`

---

### 6. Implement Lightweight CVE Monitoring for Critical Vulnerabilities

- **Description:** The project currently lacks a lightweight, automated way to monitor for critical security vulnerabilities (CVEs) within its dependencies. This means we are not proactively identifying high-impact security risks that could affect users.
- **Triage Notes:** A process for monitoring and addressing critical security vulnerabilities is required for production readiness.
- **Label:** `1.0`

---

### 7. Create Basic Stability Documentation for 1.0-beta

- **Description:** Add a simple stability page to docs clearly marking what's stable vs experimental. Basic table format: Feature | Status (Stable/Experimental) | Notes. The documentation should explicitly label the Durable Object Database and Real-time features as experimental. Cover core features only - rendering, routing, server functions. No API guarantees or complex migration guides - just clear expectations.
- **Triage Notes:** Documentation must clearly distinguish between stable and experimental features to ensure clear expectations.
- **Label:** `1.0`

---

### 8. Fix Context Providers in Layouts - Client-Side Double Evaluation Issue

- **Description:** Context providers in layout components work correctly for SSR but fail on the client-side in development. Root cause is double-evaluation of modules containing context, causing provider/consumer mismatch. Affects standard RSC patterns that should work. Only occurs in dev, not in builds/releases.
- **Triage Notes:** This bug affects a subset of users who use context providers in layouts.
- **Label:** `bug`

---

### 9. Align React Dependencies to Peer-Only Strategy

- **Description:** This is a coordinated breaking change to align our React dependency strategy with a peer-dependency model. It involves three parts: 1) Update starters to use the latest React canary packages (`react`, `react-dom`, `react-server-dom-webpack`) as explicit dependencies. 2) Change the SDK's `package.json` to list these React packages as `peerDependencies` only, removing the fallback versions. 3) Modify the `reactConditionsResolverPlugin` to resolve React *only* from the user's project.
- **Triage Notes:** This breaking change gives users control over React versions and addresses bugs in component libraries.
- **Label:** `1.0-beta`

---

### 10. Upgrade to Vite v7

- **Description:** Upgrade the ecosystem to Vite v7. This involves two parts: 1) Update the `vite` dependency in all starters to the latest v7 release. 2) Widen the `vite` `peerDependency` range in the SDK's `package.json` to be compatible with v7.
- **Triage Notes:** This breaking change keeps the framework aligned with its core tooling.
- **Label:** `1.0-beta`

---

### 11. Align Cloudflare Vite Plugin to Peer-Only Strategy

- **Description:** This change aligns the Cloudflare Vite plugin with our new dependency strategy. It involves two parts: 1) Update starters to use the latest `@cloudflare/vite-plugin` as an explicit dependency. 2) Change the SDK's `package.json` to list the plugin as a `peerDependency` only, removing it as a direct dependency.
- **Triage Notes:** This breaking change provides architectural consistency and user control over this dependency.
- **Label:** `1.0-beta`

---

### 12. Fix Flaky Style Smoke Tests in CI

- **Description:** The smoke tests for stylesheets are currently skipped in CI due to flakiness. This creates a blind spot for potential regressions in our styling pipeline. The tests need to be investigated, fixed, and re-enabled.
- **Triage Notes:** Needs to be passing to hold us to the 1.0 contract.
- **Label:** `1.0`

---

### 13. Deprecate Standard Starter in Favor of Minimal Starter

- **Description:** The standard starter, which includes the primary Prisma integration, is being deprecated. The minimal starter will become the default recommendation, aligning with the strategy of not having a deep, built-in Prisma integration in the SDK itself.
- **Label:** `1.x`
- **Triage Notes:** This is a strategic decision to focus on core SDK capabilities. This task is slated for a post-1.0 release as it has external dependencies.

---

### 14. Fix Windows-Specific Path Issues in Directive Scanner

- **Description:** The directive scanner fails on Windows due to incorrect handling of Windows' ESM URL scheme. This breaks the development workflow for users on Windows.
- **Triage Notes:** This bug affects Windows users. While Windows-specific issues are generally de-prioritized, this breaks a core function.
- **Label:** `bug`, `1.0`

---

### 15. Ensure "use client" Module Caching Works Correctly During HMR

- **Description:** There are concerns that modules marked with `"use client"` are not being cached or re-evaluated correctly during Hot Module Replacement (HMR), leading to unpredictable behavior in development.
- **Triage Notes:** HMR stability is a core requirement for a smooth developer experience.
- **Label:** `bug`, `1.0-beta`

---

### 16. Add Logging for `rwsdk/db` Migrations in Development

- **Description:** The experimental `rwsdk/db` package does not provide clear logging output when running database migrations during development, making it difficult to debug.
- **Triage Notes:** This is an enhancement for an experimental feature.
- **Label:** `experimental`

---

### 17. Add Performance Checks to CI

- **Description:** The CI pipeline currently lacks automated performance checks to monitor for regressions.
- **Triage Notes:** This is a `future` consideration for maintaining long-term quality.
- **Label:** `future`

---

### 18. Remove Deprecated APIs Before 1.0 Release

- **Description:** Several APIs, such as the `headers` export, have been deprecated. These should be removed before the 1.0 release to ensure a clean and stable API surface.
- **Triage Notes:** Removing deprecated APIs is a necessary step for a major version release.
- **Label:** `1.0`

---

### 19. Document Limitations of Passing Props to Client Components

- **Description:** There are limitations on what props can be passed from Server Components to Client Components (e.g., functions are not serializable). This needs to be clearly documented to prevent user confusion.
- **Triage Notes:** Clear documentation on this core RSC concept is required.
- **Label:** `1.0`

---

### 20. Automate Client Entry Point Generation

- **Description:** Users are currently required to manually create and maintain client entry points. This process could be automated to improve the developer experience.
- **Triage Notes:** This is a developer experience enhancement for a future release.
- **Label:** `future`

---

## Output: Triage of Existing Issues

This section lists the triage decisions for existing GitHub issues.

---

### 21. Issue #677: dev mode broken when using naming files *.client.tsx in ^0.3.0

- **Issue:** #677
- **Label:** `bug`
- **Triage Notes:** This bug affects a specific file naming convention.

---

### 22. Issue #674: Route with renderToStream not working as expected

- **Issue:** #674
- **Label:** `bug`, `1.0`
- **Triage Notes:** While `renderToStream` is a public API, it is not on the critical path for most users.

---

### 23. Issue #667: Prefix params not passed down to routes

- **Issue:** #667
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug breaks a core routing feature.

---

### 24. Issue #656: Proposal: Expose React 19 Error Handling APIs in RedwoodSDK

- **Issue:** #656
- **Label:** `1.x`
- **Triage Notes:** This is a feature request for a fundamental capability. As it is backwards-compatible, it is suitable for a minor release.

---

### 25. Issue #651: Allow specifying http method in route definition

- **Issue:** #651
- **Label:** `1.x`
- **Triage Notes:** This is a feature request for a fundamental capability. As it is backwards-compatible, it is suitable for a minor release.

---

### 26. Issue #641: [feature request] Client-side observer for realtime connection state

- **Issue:** #641
- **Label:** `future`
- **Triage Notes:** This is a feature enhancement for the real-time system, which is currently considered experimental.

---

### 27. Issue #639: Docs: `bash frame="none"` prefix doesnt work

- **Issue:** #639
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** Incorrect documentation for a core command affects user perception.

---

### 28. Issue #635: Client components importing Prisma enums cause cryptic WASM build errors

- **Issue:** #635
- **Label:** `bug`
- **Triage Notes:** With the standard starter (which includes Prisma) being deprecated, the priority of this issue is reduced.

---

### 29. Issue #627: Support inlining client entry point in Document

- **Issue:** #627
- **Label:** `bug`, `experimental`
- **Triage Notes:** This bug affects an experimental feature.

---

### 30. Issue #624: Suggest "use client" wrapper when `react-dom/server` imported

- **Issue:** #624
- **Label:** `1.0`, `area:error-messages`
- **Triage Notes:** This enhancement improves error messages.

---

### 31. Issue #619: Support usage with vitest (or communicate that we do not)

- **Issue:** #619
- **Label:** `1.x`
- **Triage Notes:** This is a feature request.

---

### 32. Issue #618: Add logging for when server actions imported but do not have "use server"

- **Issue:** #618
- **Label:** `1.0`, `area:error-messages`
- **Triage Notes:** This enhancement improves error messages for a common mistake.

---

### 33. Issue #617: Support CSS modules in server components

- **Issue:** #617
- **Label:** `1.x`
- **Triage Notes:** This is a new feature.

---

### 34. Issue #570: Suspense fallback not triggered during client navigation RSC payload rehydration

- **Issue:** #570
- **Label:** `bug`
- **Triage Notes:** This bug breaks a fundamental React pattern, but client navigation is not a critical path.

---

### 35. Issue #569: initClient fails when loading 'new Response(await renderToStream(< />, { Document })'

- **Issue:** #569
- **Label:** `bug`
- **Triage Notes:** This bug breaks a core feature (streaming) but `renderToStream` is not a critical path API.

---

### 36. Issue #568: Support setting response.status from middleware

- **Issue:** #568
- **Label:** `status: close`
- **Closing Comment:** This is now supported via `request.info.response.status`.

---

### 37. Issue #566: Communicate that we only support stylesheet urls

- **Issue:** #566
- **Label:** `status: close`
- **Closing Comment:** This is resolved. We now support importing CSS modules and CSS files in "use client" components. Support for CSS in Server Components is being tracked in issue #33.

---

### 38. Issue #555: automatically append "/" to end of routes.

- **Issue:** #555
- **Label:** `bug`, `1.0`
- **Triage Notes:** This bug breaks a key development workflow.

---

### 39. Issue #552: Allow "userspace" to overwrite the Request object in RSC network requests.

- **Issue:** #552
- **Label:** `future`
- **Triage Notes:** This is a feature request.

---

### 40. Issue #529: suggestion: use recent compatibility date in wrangler.json for the starters

- **Issue:** #529
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug breaks a core feature (streaming) and produces a cryptic error.

---

### 41. Issue #500: Tutorial: Dark / light mode

- **Issue:** #500
- **Label:** `future`
- **Triage Notes:** This is a documentation request.

---

### 42. Issue #498: Support handling errors thrown from action handlers

- **Issue:** #498
- **Label:** `1.0`
- **Triage Notes:** Proper error handling for server functions is a core requirement.

---

### 43. Issue #495: Using Cloudflare Agents

- **Issue:** #495
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** Inability to use a key Cloudflare feature is a significant compatibility bug.

---

### 44. Issue #477: Shadcn-ui in Full Stack Tutorial

- **Issue:** #477
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This issue blocks users from completing the tutorial with a popular library.

---

### 45. Issue #472: Support redirecting in action handlers

- **Issue:** #472
- **Label:** `1.0`
- **Triage Notes:** Redirects from server actions are a fundamental web development pattern.

---

### 46. Issue #471: Incorrect "use client" transform for inlined functions

- **Issue:** #471
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug affects the core `"use client"` transformation logic.

---

### 47. Issue #470: Use project vite config for seed.ts

- **Issue:** #470
- **Label:** `bug`, `1.0`
- **Triage Notes:** This bug breaks a key development workflow.

---

### 48. Issue #468: Bug Report: Dev Server Hangs from I/O Context Issues in Cloudflare Workers

- **Issue:** #468
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** A hanging dev server is a show-stopper bug.

---

### 49. Issue #464: Surface clientId for realtime

- **Issue:** #464
- **Label:** `future`
- **Triage Notes:** This is a feature request.

---

### 50. Issue #432: Dynamic ssr: false to skip ssr rendering for some component

- **Issue:** #432
- **Label:** `future`
- **Triage Notes:** This is a feature request.

---

### 51. Issue #425: Support `<link href="/src/styles.css" rel="stylesheet">`

- **Issue:** #425
- **Label:** `1.0`
- **Triage Notes:** This addresses an inconsistency in how stylesheets are referenced.

---

### 52. Issue #406: Docs: Missing prisma migrate dev step in "Creating the Application" section of Full Stack tutorial

- **Issue:** #406
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** A missing, critical command in the main tutorial is a bug that will block every new user.

---

### 53. Issue #405: Docs: Create a guide on how to cache

- **Issue:** #405
- **Label:** `future`
- **Triage Notes:** This is a documentation request.

---

### 54. Issue #387: Support FormData in realtime

- **Issue:** #387
- **Label:** `future`
- **Triage Notes:** This is a limitation in an experimental feature.

---

### 55. Issue #379: Error react-server condition must be enabled in any environment

- **Issue:** #379
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** A newly created project failing with a configuration error is a critical bug.

---

### 56. Issue #368: throw new Error(`Failed to resolve ${packageName}`);

- **Issue:** #368
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This bug prevents projects from running.

---

### 57. Issue #356: Standard starter breaks when project path has __ in it

- **Issue:** #356
- **Label:** `bug`
- **Triage Notes:** This bug affects a specific project path structure.

---

### 58. Issue #350: (docs): Incorporate Deploy to Staging info from Blog post to Docs

- **Issue:** #350
- **Label:** `future`
- **Triage Notes:** This is a documentation request.

---

### 59. Issue #343: Support disabling `wrangler types` generation

- **Issue:** #343
- **Label:** `future`
- **Triage Notes:** This is a feature request.

---

### 60. Issue #337: Support inlined 'use server'

- **Issue:** #337
- **Label:** `1.0`
- **Triage Notes:** Supporting the full React directive syntax is important for developer experience.

---

### 61. Issue #311: Avoid repetition for routes+links

- **Issue:** #311
- **Label:** `future`
- **Triage Notes:** This is a developer experience enhancement.

---

### 62. Issue #291: Check if imports in inline scripts in document are possible

- **Issue:** #291
- **Label:** `future`
- **Triage Notes:** This is an exploratory research task.

---

### 63. Issue #290: Mention ctx and middleware in auth docs - why it placed there, what happens on failure with throwing

- **Issue:** #290
- **Label:** `1.x`
- **Triage Notes:** This is a documentation request.

---

### 64. Issue #286: Better error for case where we import { Button } but export default function Button()

- **Issue:** #286
- **Label:** `1.0`
- **Triage Notes:** This addresses a common source of confusion with a cryptic error message.

---

### 65. Issue #285: Investigate undefined error after export changes

- **Issue:** #285
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** An `undefined` error provides no actionable information.

---

### 66. Issue #273: Handle "h is not a function" error masking real issues

- **Issue:** #273
- **Label:** `bug`, `1.0-beta`
- **Triage Notes:** This vague error masks the true cause of a problem.

---

### 67. Issue #271: Add smoke test script to check HTML and client response

- **Issue:** #271
- **Label:** `1.0`
- **Triage Notes:** Adding smoke tests improves our ability to catch regressions.

---

### 68. Issue #206: Cursor Rules: Ship with a set of Cursor Rules for building with RedwoodSDK

- **Issue:** #206
- **Label:** `future`
- **Triage Notes:** This is a tooling enhancement.

---

### 69. Issue #197: prisma (seed): Add docs to explain how to seed from a CSV file given workers cannot access filesystem to read files

- **Issue:** #197
- **Label:** `1.0`
- **Triage Notes:** This documentation is needed to unblock a common development workflow.

---

### 70. Issue #196: starters: Consider adding `public` directory to starters (t least standard) to show where to store static assets like styles, images, fonts

- **Issue:** #196
- **Label:** `1.0`
- **Triage Notes:** Establishing a clear convention for static assets improves the developer experience.

---

### 71. Issue #141: Cron: Unable to test cron triggers using Cloudflare's `wrangler dev --test-scheduled` method

- **Issue:** #141
- **Label:** `bug`, `1.0`
- **Triage Notes:** The inability to test a feature locally is a bug that breaks a key development workflow.
