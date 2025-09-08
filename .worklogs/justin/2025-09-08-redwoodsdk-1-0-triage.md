# Work Log: 2025-09-08 - RedwoodSDK 1.0 Triage Session

## Plan / Agenda

The goal of this session is to triage tasks for the RedwoodSDK 1.0-beta and 1.0 releases. The primary lens for every decision is **perceived stability**: does this task undermine the feeling that RedwoodSDK is stable to use in dev or production? The goal is to be ruthless and pragmatic.

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

### Labels

- **`1.0-beta`**: Must be fixed before Beta cut.
- **`1.0`**: Must be fixed before the 1.0 release, but not Beta-blocking.
- **`1.x`**: Nice-to-have, safe for minors after 1.0.
- **`future`**: Exploratory, feature work, performance monitoring.
- **`experimental`**: Issues around db, unbundled deps, inline entrypoints, route HMR, CSS in RSC, Vitest, perf checks — not yet stable/contracted.

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

## Discussion

- We initially formatted proposed issues with just a title, label, and rationale.
- We decided to add a `Description` field to each proposed issue to provide necessary context for what the problem is, separate from the rationale of why it's being prioritized.
- The issue of server instability and swallowed errors are being kept together, as the swallowed errors are a primary contributor to the instability and the poor developer experience.

## Output: Proposed Issues

This section lists the issues identified for creation. New issues are added here before being created in the issue tracker.

---

### 1. Investigate and Ensure Compatibility with Popular Component Libraries (ShadCN, Base UI)

- **Description:** Users experience friction when integrating popular component libraries like ShadCN and Base UI. The common failure points appear to be related to stylesheet inclusion and the mass use of `"use client"` directives in library components, which tests the boundaries of our current implementation. This is a significant hurdle for developers migrating from other ecosystems where these libraries work out-of-the-box.
- **Rationale:** Friction with popular libraries is a primary source of perceived instability. Ensuring these libraries work smoothly is critical for making the 1.0-beta feel usable for common, real-world development scenarios.
- **Label:** `1.0-beta`

---

### 2. Address Dev Server Instability and Swallowed Errors during SSR

- **Description:** When an error occurs during server-side rendering, the dev server can hang, breaking the Hot Module Replacement (HMR) loop. The associated error messages are often swallowed, appearing as `undefined` or a blank error, which gives the developer no actionable information. This forces a manual server restart and creates a highly disruptive and frustrating debugging experience.
- **Rationale:** A hanging dev server is a show-stopper that breaks the core development loop. This directly violates the 1.0-beta stability criteria and severely undermines developer confidence.
- **Label:** `1.0-beta`

---

### 3. Improve Error Messages with Actionable Suggestions and Links to Docs

- **Description:** Many error messages are currently terse and lack guidance. For example, when a user encounters an error about `react-dom/server` being incompatible with RSCs, we don't suggest common causes (e.g., using server-only code in a client component) or solutions. We should systematically catch common errors, provide helpful suggestions, and link to a dedicated troubleshooting section in the documentation.
- **Rationale:** While the most critical SSR errors are a beta-blocker, a broader initiative to improve all error messages is essential for a polished 1.0. This makes the framework feel more supportive and confidence-inspiring for new users.
- **Label:** `1.0`

---

### 4. Implement Lightweight CVE Monitoring for Critical Vulnerabilities

- **Description:** The project currently lacks a lightweight, automated way to monitor for critical security vulnerabilities (CVEs) within its dependencies. This means we are not proactively identifying high-impact security risks that could affect users.
- **Rationale:** To be considered production-ready, the framework must have a basic mechanism for flagging and addressing critical security vulnerabilities. This is a core requirement for the trust and stability promise of a 1.0 release.
- **Label:** `1.0`
