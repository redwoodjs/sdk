# 2025-09-15: Debugging Vite/esbuild Symbol Collision in Linker Pass

## Problem Definition

During the production build's final "linker" pass, the process fails with an esbuild error: `The symbol "l0" has already been declared`. This happens when the final `worker.js` chunk is being transpiled by esbuild.

## Investigation Log & Thought Process

My initial observation is that this error occurs during the final step where our multi-phase build process combines the intermediate `worker.js` bundle with the separately-built `ssr_bridge.js` bundle. Both are pre-compiled and minified artifacts. The error strongly suggests that both files contain an identical, minified identifier (like `l0`) at the top-level scope, causing a redeclaration error when they are merged.

**Initial Hypothesis: Why isn't the bundler handling this?**

Normally, a bundler like Rollup is responsible for de-conflicting identifiers to prevent exactly this kind of collision. It should be able to see `const l0` in both inputs and safely rename one to `const l0$1`. The fact that it's not doing this is strange and suggests our scenario is unusual.

The key difference seems to be that we are not feeding the bundler a collection of small, original source modules. Instead, we are asking it to merge two large, pre-compiled artifacts. My theory is that the bundler has lost critical semantic information in this process. When it sees the minified code, it cannot safely determine the scope of every variable with 100% confidence. Faced with this ambiguity, it can't perform its usual safe renaming, and instead attempts a more direct merge of the scopes, which correctly results in a collision error. We are, in effect, breaking the contract of how a bundler is expected to work by feeding it artifacts instead of sources.

This implies that the responsibility falls on us to ensure the artifacts we generate are "good citizens" that can be safely imported. We need to provide an explicit scope boundary.

**Attempt 1: IIFE via `load` hook - FAILED**

My first idea was to enforce a scope boundary at the last possible moment. In the `ssrBridgePlugin`, I could use the `load` hook to read the `ssr_bridge.js` bundle and wrap its contents in an Immediately Invoked Function Expression (IIFE).

- **Outcome**: This failed with a new error: `'import', and 'export' cannot be used outside of module code`.
- **Reasoning**: This was a fundamental mistake. The `ssr_bridge.js` bundle is an ES Module, and its `export` statements must be at the top level. Wrapping it in a plain function breaks this rule.

**Architectural Flaw in Attempt 1**

Furthermore, on reflection, using the `load` hook is architecturally wrong for our system. The entire purpose of the second "linker" pass is to ensure that the SSR bundle is processed by the *worker* environment's full plugin pipeline, applying necessary Cloudflare-specific transformations. The `load` hook short-circuits this, providing the final content *before* those transformations can run. This would inevitably lead to runtime errors.

## Current Plan: Modify the Source of the Problem

Based on this, the solution cannot be in how we *consume* the SSR bundle, but in how we *produce* it.

I've identified that the `ssr_bridge` is built as a library using Vite's `build.lib` feature in `configPlugin.mts`. This is the correct place to intervene.

My plan is to modify the output of this library build. I will keep the format as `'es'`, but I will use Rollup's `output.banner` and `output.footer` options to wrap the bundle's contents. The goal is to create a valid ES module that internally uses an IIFE to isolate its scope, but externally presents its exports cleanly.

The transformed output should look like this:
`export const { ...exports... } = (function() { ...original bundle code...; return { ...exports... }; })();`

This addresses all the issues:
1.  **Scope is Isolated**: The internal code is wrapped, preventing symbol collisions.
2.  **Valid ESM**: The `export` statement is at the top level.
3.  **Correct Transformations**: Because we're not using a `load` hook, the resulting artifact will be correctly processed by the linker pass's plugin pipeline.

This feels like the correct, non-hacky solution that addresses the root cause.
