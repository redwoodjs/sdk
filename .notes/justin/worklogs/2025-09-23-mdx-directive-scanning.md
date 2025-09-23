# 2025-09-23: MDX Directive Scanning

## Problem

The directive scanner, which uses `esbuild` to traverse the dependency graph and find `"use client"` and `"use server"` directives, does not support non-standard file types like MDX. When an MDX file is included in the scan, `esbuild` fails because it doesn't have a configured loader for the `.mdx` extension.

## Initial Attempts & Hurdles

1.  **Attempt 1: Add `.mdx` to filter and loader.**
    *   **Action:** Modified the file filter in `runDirectivesScan.mts` to include `.mdx` and added a basic `onLoad` rule to treat it with the `tsx` loader.
    *   **Outcome:** Failed. `esbuild` threw a syntax error because raw MDX is not valid TSX.

2.  **Attempt 2: Transform MDX to TSX.**
    *   **Action:** Used a hardcoded `mdxTransform` function from `vite-plugin-mdx` within the scanner's `onLoad` hook to convert MDX content to JSX before passing it to esbuild.
    *   **Outcome:** This worked, but it introduced an undesirable direct dependency on `vite-plugin-mdx` within the scanner. The scanner should be agnostic and respect the user's actual Vite configuration, not bake in its own.

3.  **Attempt 3: Simulate Vite's `load`/`transform` pipeline.**
    *   **Action:** Refactored the `onLoad` hook to simulate Vite's entire plugin pipeline for all file types. It would find the correct plugins from the user's config and run their `load` and `transform` hooks.
    *   **Outcome:** This was a more correct approach, but it felt like over-engineering and added significant complexity to the main scanning logic for all file types, which was a concern.

## Current Plan

The current approach is a refinement of the third attempt, designed to isolate complexity and minimize risk.

1.  **Isolate Logic:** Extract the Vite-aware `load` and `transform` logic into a new, dedicated function, `viteAwareLoad`, in its own file (`sdk/src/vite/viteAwareLoad.mts`).
2.  **Conditional Application:** Refactor the scanner's `onLoad` hook to use this new `viteAwareLoad` function *only* for non-standard file types (e.g., `.mdx`). Standard JavaScript/TypeScript files will continue to be processed with the original, simpler file-reading logic.
3.  **Testing:** Add a unit test for `viteAwareLoad` to verify its behavior with mock Vite plugins, ensuring the `load` and `transform` hooks are correctly simulated.
4.  **Fix Types:** Address TypeScript errors that have surfaced during this refactoring.

## Refined Rationale & The `ast-grep` Approach

After implementing the Vite-aware loader, there was significant concern about the complexity. Simulating Vite's `load` and `transform` pipeline, even for a subset of files, is a step towards re-implementing Vite itself, which is a path fraught with risk and maintenance overhead. The goal is to solve the immediate problem with the simplest, most robust solution.

### Justification for a Targeted Fix

A gut-check revealed that the scope of this problem is much smaller than initially feared.
-   **esbuild covers the basics**: Standard `.js`, `.jsx`, `.ts`, and `.tsx` files are already handled by esbuild's native capabilities.
-   **Other frameworks are out of scope**: While other component formats like `.vue` or `.svelte` exist, this is a React-centric framework. Supporting them is not a practical requirement.
-   **MDX is the only real edge case**: The only common file type that compiles to React components and could therefore contain directives or import client components is MDX.

This realization means we do not need a generic, "future-proof" solution. We need a pragmatic, surgical fix for MDX.

### A New, Simpler Plan: `ast-grep`

Instead of fully transforming the MDX file, we only need to give esbuild enough information to follow its dependency graph. This can be achieved by extracting only the `import` and `export` statements.

The new plan is to investigate if `ast-grep`, which we already use in `findSpecifiers.mts`, can parse MDX files.
-   **If yes**: We will create a custom `onLoad` hook for `.mdx` files. This hook will use `ast-grep` to parse the MDX file, extract all import/export statements, and return them as a plain JavaScript string. This "skeleton" module is all esbuild needs to trace dependencies, completely avoiding the need for the MDX transform pipeline.
-   **If no**: We will fall back to the previous approach of passing the MDX transform function from the user's Vite config, knowing that we've exhausted simpler alternatives.

## Final Plan & Rationale after Deeper Research

The investigation into `ast-grep` and other lightweight parsers confirmed a foundational challenge: parsing MDX is not the same as parsing JavaScript.

### Discarded Alternative: Lightweight Parsers (`ast-grep`, `es-module-lexer`)

-   **Problem**: These tools are built to parse syntactically valid JavaScript. They cannot handle the mixed syntax of MDX and will fail immediately upon encountering Markdown tokens (e.g., `#`, `>`). They do not support partial or "graceful failure" parsing.

### Discarded Alternative: Regex Heuristics

-   **Problem**: While seemingly simple, using regular expressions to find `import`/`export` statements is extremely brittle. It would fail on common patterns like multi-line imports and incorrectly capture imports from documented code examples within Markdown fences, leading to silent and hard-to-debug failures.

### The Correct Tool for the Job

-   **Conclusion**: Research into the MDX toolchain itself (the `unified` and `remark` ecosystem) revealed that any tool capable of reliably distinguishing the JavaScript/ESM portions of an MDX file from the Markdown portions *is* an MDX compiler. The official `@mdx-js/mdx` package is the purpose-built, and paradoxically, the most "lightweight" *correct* tool for this task.

### The Final, Pragmatic Plan

Based on these findings, we are returning to the most direct and robust solution, confident that it is the simplest path that guarantees correctness.

1.  **Surgically Extract the MDX Transform**: In `configPlugin.mts`, find the user's configured `vite-plugin-mdx` from the resolved list of Vite plugins.
2.  **Pass the Transform Function**: Pass its `transform` function (which is a wrapper around the `@mdx-js/mdx` compiler) down to the `runDirectivesScan` function.
3.  **Targeted Application**: In the scanner's `onLoad` hook, use this function *only* for `.mdx` files. This will convert the MDX into pure TSX that esbuild can natively understand. For all other standard file types, esbuild will handle them directly.

This approach avoids re-implementing any part of Vite or MDX, leverages the user's own configuration, and solves the problem with the officially supported toolchain.
