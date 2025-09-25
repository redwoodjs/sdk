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

## Plan

The investigation into lightweight parsers confirmed a foundational challenge: parsing MDX is not the same as parsing JavaScript.

### Discarded Alternative: Lightweight Parsers (`ast-grep`, `es-module-lexer`)

-   **Problem**: These tools are built to parse syntactically valid JavaScript. They cannot handle the mixed syntax of MDX and will fail immediately upon encountering Markdown tokens (e.g., `#`, `>`).

### Discarded Alternative: Regex Heuristics

-   **Problem**: Using regular expressions to find `import`/`export` statements is brittle. It would fail on common patterns like multi-line imports and incorrectly capture imports from documented code examples within Markdown fences.

### The Correct Tool for the Job

-   **Conclusion**: Research into the MDX toolchain (`unified` and `remark`) revealed that any tool capable of reliably distinguishing the JavaScript/ESM portions of an MDX file from the Markdown portions *is* an MDX compiler. The official `@mdx-js/mdx` package is the purpose-built tool for this task.

### Implementation Plan

The plan is to make the directive scanner self-sufficient by integrating the MDX compiler directly.

1.  **Add Dependency**: Add `@mdx-js/mdx` as a dependency to the SDK.
2.  **Integrate Compiler**: In `runDirectivesScan.mts`, import the `compile` function from `@mdx-js/mdx`.
3.  **Targeted Transformation**: In the scanner's `onLoad` hook, detect `.mdx` files, transform their content to TSX using the `compile` function, and return the result to esbuild with the `tsx` loader. Standard file types will be handled by esbuild as before.

This approach ensures that MDX files are processed correctly without coupling the scanner to the user's Vite plugin configuration.

## PR

### feat: Add MDX support to directive scanner and improve E2E tests

#### Problem

This work addresses two separate but related issues:

1.  **MDX Directive Scanning**: The directive scanner, which uses `esbuild` to traverse the dependency graph, could not process `.mdx` files. This caused the build to fail in projects that used MDX, as `esbuild` does not have a native loader for the format.
2.  **E2E Test Flakiness**: The end-to-end tests were prone to intermittent failures. These failures were caused by race conditions where test interactions (like clicks) would happen before client-side hydration was complete, or where tests would hold onto stale DOM element references that had been replaced by React.

#### Solution

##### 1. Self-Contained MDX Processing in Scanner

After exploring several alternatives, the most robust solution was to make the scanner self-sufficient.

-   The `@mdx-js/mdx` package is now a direct dependency of the SDK.
-   The scanner's `onLoad` hook in `runDirectivesScan.mts` now detects `.mdx` files and uses the imported `compile` function to transform their content into TSX.
-   This transformed code is then passed to `esbuild`, which can process it natively.

This approach keeps the scanner decoupled from the user's Vite configuration and ensures that MDX files are handled correctly.

##### 2. E2E Test Harness Improvements and Best Practices

To address test flakiness, the E2E test harness and conventions were updated:

-   **`waitForHydration` Utility**: A new `waitForHydration` function has been added to the test harness. It waits for `document.readyState` to be complete and then adds a short, pragmatic delay to ensure React has fully hydrated the page. This should be used before simulating any user interaction.
-   **Best Practices Documentation**: The `CONTRIBUTING.md` file has been updated with a new "Best Practices" section for E2E tests. It includes an annotated example that demonstrates:
    -   Using `waitForHydration` before interactions.
    -   Re-fetching DOM elements immediately before they are used to avoid stale references.
    -   Using helper functions to improve test legibility.
-   **Test Refactoring**: Existing tests in the `mdx` and `useid-test` playgrounds have been refactored to use the new `waitForHydration` utility and follow the updated best practices.

#### Testing

-   The `mdx` playground now passes its E2E tests, confirming that the directive scanner correctly processes `.mdx` files.
-   The refactored E2E tests are more stable and reliable.
