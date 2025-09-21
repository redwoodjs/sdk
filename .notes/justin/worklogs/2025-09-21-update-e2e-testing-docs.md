# Work Log: Update E2E Testing Documentation

**Date:** 2025-09-21

## Problem

The architecture document for end-to-end testing is missing a rationale for the choice of testing stack (vitest, puppeteer-core, and custom scripts) over more integrated solutions like Playwright. The filename also doesn't match its title, "End-to-End Testing".

## Plan

1.  Rename `docs/architecture/smokeTesting.md` to `docs/architecture/end-to-end-testing.md` to match its H1 title.
2.  Add a new FAQ entry to the document explaining why the current stack was chosen, emphasizing the need for flexibility when testing a framework, the limitations of heavier tools like Playwright for our use case, and the pragmatic decision to extend our existing smoke testing infrastructure.

---

## Log

- Renamed the file to `docs/architecture/endToEndTesting.md`.
- Added the new FAQ section as planned. The content covers the key points about flexibility, framework-specific testing needs, and the pragmatic choice to build on existing tools.
