# Router Performance & Benchmarking

This document captures our findings on the router's performance and serves as a guide for future benchmarking and optimization work.

## Findings & Discoveries

Our initial benchmarking of the "standard" router implementation revealed several key characteristics:

### 1. What is Cheap

The following operations add negligible overhead (often < 1μs per request):

- **Deep Nesting**: Having 5-10 levels of prefixes/nesting adds very little time.
- **Layouts**: Wrapping routes in multiple layouts (up to 5 tested) is very efficient.
- **Global Middleware**: A handful of global middlewares don't significantly impact performance.
- **`matchPath` Internals**: The core regex matching for a single route is extremely fast (millions of ops/sec).

### 2. The Bottleneck: Linear Scans

The primary "hotspot" in the current router is the **O(n) linear scan** through the route table.

- As the number of routes increases (100-200+), the time spent matching increases linearly.
- **Worst-case performance** occurs when:
  - A request matches a route at the very end of a large table.
  - A request doesn't match any route (404), requiring a scan of every single route definition.

## Interpreting Benchmarks

When running `pnpm exec vitest bench`, focus on the `hz` (operations per second) and the relative comparison (e.g., `0.96x slower`).

### What is Noise vs. Reality

- **0.95x to 1.05x (±5%)**: This is generally **noise**. Benchmark results can vary based on machine load, CPU frequency scaling, and background tasks. For example, if you see a 4% slowdown (`0.96x`), do not treat it as a definitive regression unless it is consistent over many runs.
- **rme (Relative Margin of Error)**: Pay attention to this value. If your `rme` is 1% but your change is `0.96x`, the result is only barely outside the margin of error.

### What a Real Regression Looks Like

An actual regression is a **consistent and significant** drop in performance across multiple runs.

- **Consistent Trend**: If every run shows `0.90x` or lower, it's likely a real regression.
- **Absolute Magnitude**: A regression in the "single route match" case (e.g., dropping from 230k hz to 180k hz) is more concerning than a tiny fluctuation in the 200-route case.

## Running Benchmarks

### Commands

We have added scripts to `sdk/package.json` to make this easier:

```bash
# Run a one-off benchmark
pnpm bench

# Establish a baseline (writes to benchmarks/router-bench-baseline.json)
pnpm bench:baseline

# Compare current code against the baseline
pnpm bench:compare
```

### Workflow for Changes

1. **Establish Baseline**: Run `pnpm bench:baseline` on the `main` branch or before you start your changes.
2. **Make Changes**: Implement your optimization or feature.
3. **Compare**: Run `pnpm bench:compare` to see the delta.
4. **Analyze**: Look at the "worst-case" benchmarks (100/200 routes). These are where optimizations (like pre-compiled regexes or indexing) will show the most benefit.

## Optimization Guardrails

If you attempt to optimize the router:

- **Don't hurt the fast path**: An optimization that speeds up the 200-route case but slows down the single-route case (the most common case) by more than 10% is usually a bad trade-off.
- **Algorithm > Micro-optimization**: Don't try to make `matchPath` faster; try to make the router call `matchPath` fewer times (e.g., by using prefix-based bucketing or a trie).
- **Correctness First**: Ensure all existing tests in `router.test.ts` pass. The router's left-to-right matching semantics must be preserved.
