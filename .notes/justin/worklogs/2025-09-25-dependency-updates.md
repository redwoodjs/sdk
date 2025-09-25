### # 2025-09-25

#### # Problem

The goal is to move from caret (`^`) to tilde (`~`) dependency ranges in `sdk/package.json` for more predictable dependency updates. After updating the dependencies, a TypeScript error surfaced in `sdk/src/vite/createViteAwareResolver.mts` due to a type mismatch between Node's `fs` module and the `FileSystem` type expected by `enhanced-resolve`.

#### # Plan

1.  **Fix TypeScript Error:**
    *   The type error appears to be caused by an outdated version of `@types/node`. The plan is to update `@types/node` to the latest version to align its `fs` module typings with `enhanced-resolve`'s expectations.

2.  **Regression Testing:**
    *   Run the complete test suite to ensure the dependency updates haven't introduced any breaking changes.
    *   Execute end-to-end tests for all playground examples to verify real-world usage scenarios.
