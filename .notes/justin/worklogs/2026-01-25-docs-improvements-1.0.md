# Docs Improvements 1.0 [2026-01-25]

## Context
We are preparing for the 1.0 release of the SDK. The goal is to have a "boring" stable core, while moving exciting but unstable features to an "Experimental" section. We also need to address some visibility issues in the docs sidebar and cleanup realtime documentation.

### Plan
1. Audit the current documentation to identify experimental features and structure issues.
2. Create a specific "Experimental" section in the docs.
3. Move relevant pages/sections to "Experimental".
4. Deprecate old realtime docs and promote `useSyncedState`.
5. Fix sidebar navigation to ensure all content is discoverable.

### Tasks
- [x] Audit existing docs
- [x] Create Experimental section
- [x] Move experimental content
- [x] Deprecate old realtime
- [x] Fix sidebar

## Audit Findings [2026-01-25]
### Experimental Features Identified (via grep)
- `useSyncedState` (`core/useSyncedState.mdx`) - Confirmed as "New Realtime", marked experimental.
- `Relationship` (in `database-do.mdx`) - "Durable Objects" feature.
- `Storybook` (`guides/frontend/storybook.mdx`) - Likely experimental.
- `Realtime` (`core/realtime.mdx`) - Old realtime, should be deprecated.

### Docs Structure Analysis
- Uses Astro Starlight (inferred from structure).
- Need to check `astro.config.mjs` for sidebar configuration.


## Plan Finalized [2026-01-25]
We have agreed on the following structure:
1.  **Experimental Section**:
    -   `Realtime` (relocate & rename `core/useSyncedState.mdx`)
    -   `Database` (relocate `core/database-do.mdx`)
    -   `Authentication` (extract Passkey Auth from `core/authentication.mdx`)
2.  **Legacy Section** (New section at bottom):
    -   `Legacy Realtime` (relocate & deprecate `core/realtime.mdx`)
3.  **Sidebar Configuration**:
    -   Top-level groups ("Guides", "Reference") will be **Uncollapsed** (Visible).
    -   Nested groups ("Frontend", etc.) will be **Collapsed** (Tidy).
    -   "Legacy" group will be **Collapsed** (User requested).
