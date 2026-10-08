# Check CSS Module server classes after the browser loads styles

## Problem

We need the CSS edit-and-reload test to distinguish a stale server class name from a browser that has not yet applied development styles. A CSS Module gives a component a generated class name and puts the matching selector in its stylesheet. If those names differ, the browser cannot apply that rule.

## Finding

The development browser receives HTML before Vite necessarily inserts the module's style element. Waiting for HTML parsing alone does not establish stylesheet readiness. The older failing snapshot contained the updated class name but transparent colors; ten fresh instrumented runs did not reproduce that exact snapshot, so its precise cause remains unconfirmed.

The released fix in commit 39da7118f updates the server's remembered CSS Module class values after an edit. We retained that fix. A browser DOM check alone can miss stale server output if client code later changes the element.

## Solution

We wait for the specific module's Vite style element to contain stylesheet rules, independently of the expected color or class. We then compare the original reload response's HTML class with the class generated after the live edit and check the displayed colors. We keep separate production assertions for stylesheet links in the initial HTML.

Temporarily restoring the original server invalidation behavior made the strengthened test fail after the stylesheet loaded: the response contained `_container_169nf_5` while the live edit produced `_container_1hnms_5`. Restoring the released fix made all four CSS tests pass, including on Vite 7. The wait therefore preserves detection of the original mismatch.

## Context

We investigated issue 1290's branch and its CSS-suite failure on 2026-10-08. Raw observations, the negative control, and successful checks are under `/tmp/rwsdk-css-investigation/`. The append-only investigation record is `/Users/chris/notes/rw/sdk/worklogs/2026-09-11-build-overwritten-1290.md`. The maintained test is `playground/css/__tests__/e2e.test.mts`.
