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

### [From Github Issues](./source-gh-issues.md)

### [From Justin's Todos](./source-gh-issues.md)

## Output

### [Output Issues](./output-issues.md)

## Discussion

- **decision** Third-party library compatibility issues, especially with component libraries like ShadCN and Base UI, are a high priority. The focus is on ensuring common libraries work smoothly.
- **observation** Server-side rendering (SSR) is a significant source of instability. Errors during SSR can hang the dev server, which breaks HMR and forces a restart.
- **observation** Error messages are often cryptic, particularly for SSR-related failures where output is sometimes swallowed entirely. There is a need for clearer, more actionable error messages with links to documentation.
- **decision** There is currently no formal CVE monitoring process. A lightweight process to address critical vulnerabilities will be established for the 1.0 release, but it is not a 1.0-beta blocker.
- **decision** By 1.0-beta, documentation must be updated to clearly label features as either "stable" or "experimental".
- **decision** The guiding principle for the 1.0 release is "good enough" over perfect. The focus is on lightweight, pragmatic fixes to address core stability issues, given the very short timeline.
- **decision** The labels `1.0-beta`, `1.0`, `1.x`, `future`, and `experimental` will function as both tags and milestones to dictate the priority and timing of work.
- **decision** Windows-specific bugs, such as the path issue in the directive scanner, will be deprioritized to the `1.0` milestone. The difficulty and time required for reproduction on Windows make it a lower priority than other stability issues for the beta.
- **decision** Major dependencies (React, Vite, `@cloudflare/vite-plugin`) will be moved from the SDK's bundled dependencies to `peerDependencies`. The starter templates will be updated to include these as direct dependencies. This is a breaking change planned for the 1.0-beta cycle to improve project independence and transparency.
- **decision** The dependency management changes will be broken into three vertically-sliced tasks: one for React, one for Vite, and one for the Cloudflare Vite plugin.
- **observation** A bug exists with the layout context functionality where context provided from a layout component is not available on the client-side during development. This appears to be caused by the module being evaluated twice.
- **decision** Vitest integration is not currently supported. Investigating and adding support is considered a `future` task, not for the 1.0 release.
- **decision** The style smoke tests are flaky and have been skipped. Fixing them is slated for the `1.0` milestone.
- **decision** When describing tasks, language should be simple and direct. Words like "overhaul" should be avoided to keep the perceived scope of work small and focused.

## Decisions