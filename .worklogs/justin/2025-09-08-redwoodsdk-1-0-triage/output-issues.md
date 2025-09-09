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