# Work Log: Renovate React Canary and Peer Dependencies Fixes

Date: 2025-12-03

## 1. Problem Definition & Goal

Renovate was not detecting updates for two critical dependency groups:
1. **React canary versions**: Despite newer canary versions being available (e.g., `19.3.0-canary-09f05694-20251201` vs current `19.3.0-canary-fd524fe0-20251121`), Renovate was not proposing updates.
2. **Cloudflare Vite plugin**: Version `1.16.0` was published 19 hours prior but was not being detected (current version `1.15.3`).

The goal was to diagnose and fix these detection issues to ensure Renovate properly tracks updates for critical peer dependencies.

## 2. Investigation: Analyzing Renovate Job Logs

A detailed Renovate job log was obtained from the Mend Developer Portal. Analysis revealed:

### React Canary Version Comparison Issue

The log showed that React dependencies had `"updates": []`, indicating no updates were detected. Investigation revealed:

- Current version: `19.3.0-canary-fd524fe0-20251121`
- Latest `next` tag version: `19.3.0-canary-09f05694-20251201` (confirmed via `npm view react@next version`)

**Root Cause**: Renovate was performing lexicographical comparison of the hash portion of the canary version string. Since `fd524fe0` comes after `09f05694` alphabetically, Renovate incorrectly determined that the current version was newer than the available version, despite the date portion (`20251201` > `20251121`) indicating otherwise.

The `versioning: "loose"` setting that was previously added did not solve this issue, as it only affects how Renovate parses version strings, not how it compares them.

### Cloudflare Vite Plugin Detection Issue

The log showed `@cloudflare/vite-plugin` also had `"updates": []` despite `1.16.0` being available. Investigation revealed:

- Current version: `1.15.3`
- Latest version: `1.16.0` (minor update)
- Registry cache timestamp: `2025-12-03T11:50:42.278Z` (approximately 2.5 hours before the job ran)

While the cache could have been stale, there was also a possibility that Renovate's default behavior might be filtering out minor updates for some reason.

## 3. Research: Renovate Configuration Options

Research was conducted into Renovate's configuration options:

- **`extractVersion`**: A regex pattern that extracts a version string from a non-standard format. This could potentially be used to normalize canary versions by extracting the date portion for comparison.
- **`updateTypes`**: Explicitly specifies which types of updates (major, minor, patch) should be detected. By default, Renovate should detect all types, but making this explicit ensures no filtering occurs.
- **`versioning: "loose"`**: Handles non-standard version formats but doesn't affect comparison logic.

## 4. Solution Implementation

### 4.1. React Canary Version Normalization

Added `extractVersion` to the React dependencies rule to extract the date portion from canary versions:

```json
"extractVersion": "^19\\.3\\.0-canary-.*-(?<date>\\d{8})$"
```

This regex extracts the date portion (e.g., `20251201`) from versions like `19.3.0-canary-09f05694-20251201`, which should help Renovate compare versions by date rather than lexicographically by hash.

**Note**: Removed `versioning: "loose"` as it was no longer needed with `extractVersion` handling the version extraction.

### 4.2. Explicit Update Types for Peer Dependencies

Added `updateTypes: ["major", "minor", "patch"]` to the `starter-peer-deps` rule to explicitly ensure all update types are detected. This addresses the Cloudflare Vite plugin issue and ensures no updates are filtered out.

### 4.3. Type Definitions Grouping Fix

Removed `@types/react` and `@types/react-dom` from exclusion lists in:
- `starter-deps` group (lines 37-38)
- `docs-and-infra-deps` group for playground/addons (lines 120-121)

This allows these packages to fall into their natural default groups (`starter-deps` and `docs-and-infra-deps` respectively) rather than being excluded or incorrectly grouped with `starter-peer-deps`.

## 5. Changes Summary

1. **Added `extractVersion`** to React canary rule to normalize version comparison by extracting date portion
2. **Removed `versioning: "loose"`** from React rule (redundant with `extractVersion`)
3. **Added `updateTypes: ["major", "minor", "patch"]`** to `starter-peer-deps` rule to explicitly allow all update types
4. **Removed `@types/react` and `@types/react-dom`** from exclusion lists to allow proper grouping

## 6. Expected Outcomes

- React canary updates should now be detected correctly by comparing versions based on the extracted date rather than lexicographical hash comparison
- All peer dependency updates (major, minor, patch) should be detected and proposed
- Type definition packages will be grouped appropriately with their related dependencies

## 7. Next Steps

- Monitor the next Renovate run to verify that React canary updates are now detected correctly
- Verify that `@cloudflare/vite-plugin` `1.16.0` is detected in the next run
- If `extractVersion` doesn't fully solve the comparison issue, consider alternative approaches such as custom versioning schemes or different extraction patterns

