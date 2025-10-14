# Missing Link Directive Scan Example

This playground example reproduces the directive scan stale map issue.

## The Problem

The directive scan only looks at files reachable from entry points. When a new import creates a dependency path to a directive-containing file that wasn't previously reachable, the HMR update doesn't trigger a re-scan, causing SSR errors.

## The Scenario

1. **Initial State**: Worker imports `ComponentA`, which doesn't import any client components
2. **Missing Link**: `ComponentB` exists with `"use client"` but isn't imported anywhere
3. **The Change**: `ComponentA` is modified to import `ComponentB`
4. **The Error**: SSR fails because `ComponentB` wasn't in the initial directive scan

## How This Example Works

- `src/components/ComponentA.tsx` - Server component (initially)
- `src/components/ComponentB.tsx` - Client component with `"use client"`
- `src/components/ComponentC.tsx` - Another client component imported by ComponentB
- `src/pages/MissingLinkPage.tsx` - Page that uses ComponentA

## Test Steps

1. Start the dev server - should work fine initially
2. Visit `/missing-link` - should render ComponentA (server component)
3. Modify `ComponentA.tsx` to import `ComponentB`
4. Refresh the page - should now show ComponentB and ComponentC without SSR errors

## Expected Behavior

With the fix, the pre-scan should have already discovered `ComponentB.tsx` and `ComponentC.tsx` during startup, so when `ComponentA` imports `ComponentB`, there should be no SSR errors.

Without the fix, you would see:
```
Internal server error: (ssr) No module found for '/src/components/ComponentB.tsx' in module lookup for "use client" directive
```