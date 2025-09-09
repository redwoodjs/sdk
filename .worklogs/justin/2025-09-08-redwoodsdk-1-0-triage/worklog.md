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