# Work Log - Community Playground Showcases

## Context

A contributor branch adds two comprehensive playground examples:

- Chakra UI (expanded beyond the existing minimal, official example)
- Ark UI (a full example)

These examples are useful as learning resources, but they increase the official playground surface area and are not covered by the same level of stable e2e coverage expected for `playground/` examples.

Maintainer decision: keep official `playground/` examples minimal and CI/e2e-covered, and reclassify broader examples as community showcases under `playground/community/`.

## Plan

- Add explicit boundaries in repo structure:
  - `playground/` - official examples (minimal, CI/e2e-covered)
  - `playground/community/` - community showcases (best-effort, not CI/e2e-covered)
- Move the contributor's Ark + expanded Chakra examples to `playground/community/`.
- Restore `playground/chakra-ui/` to the minimal official version from `main`.
- Update docs:
  - Add `playground/community/README.md`
  - Update `CONTRIBUTING.md` to codify support levels and test expectations

## Notes

- `pnpm-workspace.yaml` currently includes `playground/**`, so `playground/community/**` must be explicitly excluded to keep these packages out of workspace installs and CI.
- The e2e runner executes `vitest` from the `playground/` directory, so `playground/vitest.config.mts` must explicitly exclude `playground/community/**` to keep community tests out of discovery.

### Changes

- Added `!playground/community/**` to `pnpm-workspace.yaml`.
- Added `**/community/**` to `playground/vitest.config.mts` test excludes.

### Repo moves

- Moved `playground/ark-ui` to `playground/community/ark-ui-showcase`.
- Moved the expanded `playground/chakra-ui` to `playground/community/chakra-ui-showcase`.
- Restored the official `playground/chakra-ui` directory from `main` via `git archive`.

### Documentation

- Added `playground/community/README.md`.
- Updated `CONTRIBUTING.md` by adding a top-level Policies section covering official vs community playground examples and AI-assisted contributions.
- Updated the playground example guidance to state that e2e tests are required for official examples.

### Follow-up

- Moved the "validate correctness and run tests" expectation into a general "Contributor responsibilities" policy, and reduced the AI-assisted note to "same expectations".
- Expanded the official vs community playground policy wording to describe the CI/e2e relationship and what is expected when changing an official example.
- Refined `CONTRIBUTING.md` policy section to be more instructional ("Use this for...", "Requirements: ...") and merged the AI-assisted note into the general responsibilities section for better flow.
- Rewrote the playground policy section in `CONTRIBUTING.md` to use direct, actionable language ("When adding or modifying...", "Use X for...") instead of a static list.
