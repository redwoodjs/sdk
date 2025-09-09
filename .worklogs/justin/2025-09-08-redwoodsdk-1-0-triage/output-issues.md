## Output: Proposed Issues

This section lists the issues identified for creation. New issues are added here before being created in the issue tracker. Existing issues will have an issue number, but still need their labels set in the issue tracker based on the label given for it below.

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

---

### 10. Fix Flaky Style Smoke Tests in CI

- **Description:** The smoke tests for stylesheets are currently skipped in CI due to flakiness. This creates a blind spot for potential regressions in our styling pipeline. The tests need to be investigated, fixed, and re-enabled.
- **Reasoning:** Reliable CI is essential for a confident 1.0 release. Shipping with known flaky/skipped tests for a core feature undermines the "feels stable" contract. A "good enough" fix to get the tests passing reliably is required for 1.0.
- **Label:** `1.0`

---

## Output: Triage of Existing Issues

This section lists the triage decisions for existing GitHub issues.

---

### Issue #677: dev mode broken when using naming files *.client.tsx in ^0.3.0

- **Issue:** #677
- **Label:** `1.0-beta`
- **Reasoning:** This bug breaks the development workflow on initial load, creating an unpredictable and unstable experience that directly impacts the perceived stability required for the beta.

---

### Issue #674: Route with renderToStream not working as expected

- **Issue:** #674
- **Label:** `1.0-beta`
- **Reasoning:** Streaming is a core rendering feature. A bug that causes connection failures and prevents content from rendering correctly is a critical stability issue that must be addressed for the beta.

---

### Issue #667: Prefix params not passed down to routes

- **Issue:** #667
- **Label:** `1.0-beta`
- **Reasoning:** The router's prefix functionality not passing parameters as expected is a critical bug that breaks a core routing pattern, making it a beta-blocker.

---

### Issue #656: Proposal: Expose React 19 Error Handling APIs in RedwoodSDK

- **Issue:** #656
- **Label:** `1.0`
- **Reasoning:** This is a feature enhancement for production monitoring. While valuable for a polished 1.0 release, it doesn't address a critical stability issue and can be deferred past the beta.

---

### Issue #651: Allow specifying http method in route definition

- **Issue:** #651
- **Label:** `1.x`
- **Reasoning:** This is a feature request to enhance the router for REST API use cases. It's a valuable addition for the future but not essential for the core stability of the 1.0 release.

---

### Issue #641: [feature request] Client-side observer for realtime connection state

- **Issue:** #641
- **Label:** `1.x`
- **Reasoning:** This is a feature enhancement for the realtime system. While it improves user experience, the core realtime functionality needs to be stabilized first, making this a post-1.0 task.

---

### Issue #639: Docs: `bash frame="none"` prefix doesnt work

- **Issue:** #639
- **Label:** `1.0-beta`
- **Reasoning:** Incorrect documentation for a core command creates a poor first impression and erodes user confidence. This is a simple but important fix for the beta release.

---

### Issue #635: Client components importing Prisma enums cause cryptic WASM build errors

- **Issue:** #635
- **Label:** `1.0-beta`
- **Reasoning:** This issue causes a cryptic build error when using a core dependency (Prisma) in a common pattern. Per the triage guidelines, obscure and misleading errors are beta-blockers because they severely undermine developer confidence.

---

### Issue #632: React7.createContext is not a function

- **Issue:** #632
- **Label:** `1.0-beta`
- **Reasoning:** This bug prevents the use of popular component libraries like Radix, which is a critical compatibility issue and a primary source of perceived instability for new users. It is a beta-blocker.

---

### Issue #627: Support inlining client entry point in Document

- **Issue:** #627
- **Label:** `experimental`
- **Reasoning:** Inlining the client entrypoint is considered an experimental feature. Issues related to it are not beta- or 1.0-blocking as the feature is not yet stable.

---

### Issue #624: Suggest "use client" wrapper when `react-dom/server` imported

- **Issue:** #624
- **Label:** `1.0`
- **Reasoning:** This aligns with the goal of improving error messages to be more actionable. It's part of the broader effort to make the framework feel more polished and supportive for the 1.0 release.

---

### Issue #619: Support usage with vitest (or communicate that we do not)

- **Issue:** #619
- **Label:** `future`
- **Reasoning:** As per the triage discussion, Vitest integration is not a priority for the 1.0 release cycle and is considered a future enhancement.

---

### Issue #618: Add logging for when server actions imported but do not have "use server"

- **Issue:** #618
- **Label:** `1.0`
- **Reasoning:** This is part of the broader initiative to improve error messages. Providing clear guidance for common mistakes like a missing directive is essential for a polished 1.0 developer experience.

---

### Issue #617: Support CSS modules in server components

- **Issue:** #617
- **Label:** `experimental`
- **Reasoning:** Support for CSS in Server Components is considered an experimental feature. It is not on the critical path for the 1.0 release.

---

### Issue #580: Fullstack tutorial: Field name difference in `ApplicationForm` vs `EditApplicationForm`

- **Issue:** #580
- **Label:** `1.0-beta`
- **Reasoning:** Errors in the primary tutorial are a significant hurdle for new users and create a poor first impression. Fixing them is critical for the perceived stability of the beta.

---

### Issue #579: Fullstack tutorial: Typescript error in `Edit.tsx`

- **Issue:** #579
- **Label:** `1.0-beta`
- **Reasoning:** Errors in the primary tutorial are a significant hurdle for new users and create a poor first impression. Fixing them is critical for the perceived stability of the beta.

---

### Issue #570: Suspense fallback not triggered during client navigation RSC payload rehydration

- **Issue:** #570
- **Label:** `1.0-beta`
- **Reasoning:** The failure of Suspense to show fallbacks during client navigation breaks a fundamental React pattern and leads to a poor user experience, making it a critical bug for the beta.

---

### Issue #569: initClient fails when loading 'new Response(await renderToStream(< />, { Document })'

- **Issue:** #569
- **Label:** `1.0-beta`
- **Reasoning:** This bug breaks a core feature (streaming) when used in a valid pattern, and produces a cryptic error. This undermines stability and must be fixed for the beta.

---

### Issue #568: Support setting response.status from middleware

- **Issue:** #568
- **Label:** `1.x`
- **Reasoning:** This is a feature enhancement for middleware. While a good addition for the future, it is not a core stability requirement for the 1.0 release.

---

### Issue #566: Communicate that we only support stylesheet urls

- **Issue:** #566
- **Label:** `1.0`
- **Reasoning:** This improves error messaging for a common point of confusion, guiding users toward supported patterns and improving the overall developer experience for the 1.0 release.

---

### Issue #555: automatically append "/" to end of routes.

- **Issue:** #555
- **Label:** `1.0`
- **Reasoning:** This addresses an inconsistency in router behavior. While not a critical bug, fixing it contributes to the overall polish and predictability expected for the 1.0 release.

---

### Issue #552: Allow "userspace" to overwrite the Request object in RSC network requests.

- **Issue:** #552
- **Label:** `1.x`
- **Reasoning:** This is a feature enhancement to support advanced caching strategies. It is not a core stability requirement for 1.0.

---

### Issue #529: suggestion: use recent compatibility date in wrangler.json for the starters

- **Issue:** #529
- **Label:** `1.0-beta`
- **Reasoning:** Using an outdated compatibility date in starters can cause immediate errors for new projects, creating a poor first impression. This is a simple but critical fix for the beta.

---

### Issue #500: Tutorial: Dark / light mode

- **Issue:** #500
- **Label:** `1.x`
- **Reasoning:** This is a documentation request for a new guide. While helpful, it is not a requirement for the 1.0 release.

---

### Issue #498: Support handling errors thrown from action handlers

- **Issue:** #498
- **Label:** `1.0`
- **Reasoning:** Proper error handling for server functions is a core requirement for building stable applications. This is a key feature for a production-ready 1.0 release.

---

### Issue #495: Using Cloudflare Agents

- **Issue:** #495
- **Label:** `1.0-beta`
- **Reasoning:** Inability to use a key Cloudflare feature like Agents is a significant compatibility issue that hinders adoption. Addressing this is important for the beta to ensure the SDK works well within its target ecosystem.

---

### Issue #477: Shadcn-ui in Full Stack Tutorial

- **Issue:** #477
- **Label:** `1.0-beta`
- **Reasoning:** This issue blocks users from completing the tutorial with a popular library (Shadcn), directly impacting both the new user experience and our third-party compatibility goals for the beta.

---

### Issue #472: Support redirecting in action handlers

- **Issue:** #472
- **Label:** `1.0`
- **Reasoning:** Redirects from server actions are a fundamental web development pattern. Lacking this feature is a significant rough edge that should be addressed for the 1.0 release to be considered feature-complete for common use cases.

---

### Issue #471: Incorrect "use client" transform for inlined functions

- **Issue:** #471
- **Label:** `1.0-beta`
- **Reasoning:** This is a bug in the core `"use client"` transformation logic. Flaws in this critical piece of the RSC implementation can break valid application code and must be fixed for the beta.

---

### Issue #470: Use project vite config for seed.ts

- **Issue:** #470
- **Label:** `1.0`
- **Reasoning:** This prevents users from customizing the Vite configuration for database seeding, breaking a key development workflow for projects with specific needs. This should be fixed for a complete 1.0 experience.

---

### Issue #468: Bug Report: Dev Server Hangs from I/O Context Issues in Cloudflare Workers

- **Issue:** #468
- **Label:** `1.0-beta`
- **Reasoning:** A hanging dev server is a show-stopper that breaks the core development loop. This directly violates the 1.0-beta stability criteria and severely undermines developer confidence.

---

### Issue #464: Surface clientId for realtime

- **Issue:** #464
- **Label:** `1.x`
- **Reasoning:** This is a feature enhancement for the realtime system. Core realtime functionality needs to be stabilized first, making this a post-1.0 task.

---

### Issue #432: Dynamic ssr: false to skip ssr rendering for some component

- **Issue:** #432
- **Label:** `1.x`
- **Reasoning:** This is a feature request for performance optimization. While useful, it is not a core stability requirement for 1.0.

---

### Issue #425: Support `<link href="/src/styles.css" rel="stylesheet">`

- **Issue:** #425
- **Label:** `1.0`
- **Reasoning:** This addresses an inconsistency in how stylesheets and scripts are referenced, which is a common source of confusion. Improving this contributes to the developer experience polish for 1.0.

---

### Issue #406: Docs: Missing prisma migrate dev step in "Creating the Application" section of Full Stack tutorial

- **Issue:** #406
- **Label:** `1.0-beta`
- **Reasoning:** A missing, critical command in the main tutorial will block every new user. This must be fixed for the beta.

---

### Issue #405: Docs: Create a guide on how to cache

- **Issue:** #405
- **Label:** `1.x`
- **Reasoning:** This is a request for a new documentation guide on an advanced topic. It's not required for the 1.0 release.

---

### Issue #387: Support FormData in realtime

- **Issue:** #387
- **Label:** `1.x`
- **Reasoning:** This is a limitation in the realtime feature, which is not yet stable. This can be addressed in a future release after the core realtime functionality is stabilized.

---

### Issue #379: Error react-server condition must be enabled in any environment

- **Issue:** #379
- **Label:** `1.0-beta`
- **Reasoning:** A newly created project failing with a configuration error is a critical bug. It completely blocks development and points to a fundamental issue in the project setup that must be resolved for the beta.

---

### Issue #368: throw new Error(`Failed to resolve ${packageName}`);

- **Issue:** #368
- **Label:** `1.0-beta`
- **Reasoning:** This is another manifestation of the critical project setup and dependency resolution issue that prevents projects from running. It is a beta-blocker.

---

### Issue #356: Standard starter breaks when project path has __ in it

- **Issue:** #356
- **Label:** `1.0`
- **Reasoning:** This is an edge-case bug related to project paths. While it's a hard blocker for affected users, its narrow scope makes it a lower priority than broader stability issues, so it can be fixed for the 1.0 release.

---

### Issue #350: (docs): Incorporate Deploy to Staging info from Blog post to Docs

- **Issue:** #350
- **Label:** `1.x`
- **Reasoning:** This is a documentation content update, which is not a requirement for the 1.0 release.

---

### Issue #343: Support disabling `wrangler types` generation

- **Issue:** #343
- **Label:** `1.x`
- **Reasoning:** This is a feature request to support an advanced integration scenario. It's not on the critical path for the 1.0 release.

---

### Issue #337: Support inlined 'use server'

- **Issue:** #337
- **Label:** `1.0`
- **Reasoning:** Supporting the full React directive syntax, including inlined placement, is important for developer experience and consistency. This addresses a rough edge for the 1.0 release.

---

### Issue #311: Avoid repetition for routes+links

- **Issue:** #311
- **Label:** `1.x`
- **Reasoning:** This is a developer experience enhancement to reduce boilerplate. While a good idea for the future, it is not a core stability requirement for 1.0.

---

### Issue #291: Check if imports in inline scripts in document are possible

- **Issue:** #291
- **Label:** `future`
- **Reasoning:** This is an exploratory research task, not a bug or a committed feature, making it suitable for a future milestone.

---

### Issue #290: Mention ctx and middleware in auth docs - why it placed there, what happens on failure with throwing

- **Issue:** #290
- **Label:** `1.x`
- **Reasoning:** This is a documentation improvement request. While useful, it is not a requirement for the 1.0 release.

---

### Issue #286: Better error for case where we import { Button } but export default function Button()

- **Issue:** #286
- **Label:** `1.0`
- **Reasoning:** This addresses a common source of confusion with a cryptic error message. Improving this is part of the overall error message polishing effort for 1.0.

---

### Issue #285: Investigate undefined error after export changes

- **Issue:** #285
- **Label:** `1.0-beta`
- **Reasoning:** An `undefined` error provides no actionable information and is a significant source of developer friction. This is a critical stability issue that falls under the beta-blocking theme of eliminating swallowed errors.

---

### Issue #273: Handle "h is not a function" error masking real issues

- **Issue:** #273
- **Label:** `1.0-beta`
- **Reasoning:** This vague error masks the true cause of a problem, making debugging extremely difficult. Replacing it with a clear, actionable error is a critical stability fix for the beta.

---

### Issue #271: Add smoke test script to check HTML and client response

- **Issue:** #271
- **Label:** `1.0`
- **Reasoning:** Adding smoke tests improves our ability to catch regressions and ensure long-term stability, which is an important goal for the 1.0 release.

---

### Issue #206: Cursor Rules: Ship with a set of Cursor Rules for building with RedwoodSDK

- **Issue:** #206
- **Label:** `future`
- **Reasoning:** This is a tooling enhancement and a nice-to-have, not a core framework feature or stability fix.

---

### Issue #197: prisma (seed): Add docs to explain how to seed from a CSV file given workers cannot access filesystem to read files

- **Issue:** #197
- **Label:** `1.0`
- **Reasoning:** This documentation is needed to unblock a common development workflow (database seeding). Providing clear guidance on this is important for the 1.0 release.

---

### Issue #196: starters: Consider adding `public` directory to starters (t least standard) to show where to store static assets like styles, images, fonts

- **Issue:** #196
- **Label:** `1.0`
- **Reasoning:** Establishing a clear convention for static assets in the starter templates improves developer experience and is a good polish item for 1.0.

---

### Issue #141: Cron: Unable to test cron triggers using Cloudflare's `wrangler dev --test-scheduled` method

- **Issue:** #141
- **Label:** `1.0`
- **Reasoning:** The inability to test a feature locally breaks a key development workflow. This should be addressed for the 1.0 release to ensure all documented features are usable.