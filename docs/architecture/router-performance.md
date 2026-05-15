# Router Performance & Benchmarking

This document captures our findings on the router's performance and serves as a guide for future benchmarking and optimization work.

## Findings & Discoveries

Our benchmarking of the router implementation revealed several key characteristics and the impact of recent optimizations.

### 1. What is Cheap

The following operations add negligible overhead (often well under 5μs per request, even on large routers):

- **Deep Nesting**: Having 5-10 levels of prefixes/nesting adds very little time.
- **Layouts**: Wrapping routes in multiple layouts (up to 5 tested) is very efficient.
- **Global Middleware**: A handful of global middlewares don't significantly impact performance.
- **Path Normalization & Caching**: Computing and caching the normalized request path once per request is cheap.
- **`matchPath` Internals**: With pre-compilation and caching, the core regex matching for a single route is extremely fast (tens of millions of ops/sec in micro-benchmarks).

### 2. The Bottleneck: Linear Scans (Still O(n), Now with a Smaller Constant)

The primary "hotspot" in the router remains the **O(n) linear scan** through the route table.

- As the number of routes increases (100-200+), the time spent matching still increases linearly.
- **Worst-case performance** occurs when:
  - A request matches a route at the very end of a large table.
  - A request doesn't match any route (404), requiring a scan of every single route definition.
- However, thanks to pre-compilation and caching, the constant factor of this scan has improved significantly (see below).

### 3. Latest Benchmark Snapshot

Using `pnpm bench:baseline` (pre-optimization) and `pnpm bench:compare` (post-optimization), we observed the following improvements:

- **`matchPath` micro-benchmarks**:
  - Static routes: **~5.3x faster** (≈ 5.9M → 31.3M ops/sec).
  - Complex parameter/wildcard patterns: **~6.3x faster**.
- **Large router scenarios**:
  - Match at end of **100 routes**: **~6.2x faster**.
  - **404** through 100 routes (no match): **~8.7x faster**.
  - Match in a **200-route** table: **~9.1x faster**.
- **Other scenarios** (deep nesting, many middlewares, complex “real-world” routes):
  - Typically range from **1.1x–1.4x faster**, reflecting the lower overhead in the hot path.

These numbers are based on the benchmark suite in `sdk/src/runtime/lib/router.bench.ts` and the JSON baselines in `sdk/benchmarks/router-bench-*.json`.

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
4. **Analyze**:
   - Look at the "worst-case" benchmarks (100/200 routes). These are where optimizations (like pre-compiled regexes, caching, or indexing) will show the most benefit.
   - Pay particular attention to `router.handle - non-match through 100 routes` and `router.handle - large router (200 routes)`, as they best capture the cost of the linear scan.

## Optimization Guardrails

If you attempt to optimize the router:

- **Don't hurt the fast path**: An optimization that speeds up the 200-route case but slows down the single-route case (the most common case) by more than 10% is usually a bad trade-off.
- **Algorithm > Micro-optimization (mostly)**: We've already implemented path compilation and caching to make `matchPath` fast; most future wins will come from reducing how often it needs to run (e.g., via prefix-based bucketing or indexing), rather than shaving a few more nanoseconds off the regex internals.
- **Correctness First**: Ensure all existing tests in `router.test.ts` pass. The router's left-to-right matching semantics must be preserved.

## Evolution & Timeline

This section tracks notable router performance changes over time so future contributors can see what has already been done and what trade-offs were made.

- **Baseline (pre-optimization)**
  - Router performed a linear scan over a flattened route table on every request.
  - `matchPath` compiled a new regular expression and re-ran token extraction on every call.
  - Large-route cases (100–200 routes) were the primary bottleneck:
    - 100-route non-match and tail-match benchmarks were in the ~20–30k ops/sec range.
    - 200-route benchmarks were in the ~20k ops/sec range.
- **Pre-compilation & Caching (current implementation)**
  - **Date**: 2025-12 (benchmarks in `sdk/src/runtime/lib/router.bench.ts` and `sdk/benchmarks/router-bench-*.json`).
  - **Changes**:
    - `defineRoutes` now pre-compiles a `CompiledRoute` table at initialization time (once per worker isolate) instead of doing work on every request.
    - `matchPath` compiles and caches regexes and parameter metadata per route pattern, and reuses them across requests.
    - The request path is normalized once per request and cached on `requestInfo.path`.
    - `prefix` middleware was updated to rely on the cached path instead of re-parsing URLs.
  - **Impact** (from `pnpm bench:compare` against the stored baseline):
    - `matchPath` micro-benchmarks improved by **~3.5×–6.5×**, depending on pattern complexity.
    - Large-route scenarios improved by **~6×–9×**:
      - 100-route tail-match: **~6.2× faster**.
      - 100-route 404: **~8.7× faster**.
      - 200-route match: **~9.1× faster**.
    - Deep nesting, multiple layouts, and middleware-heavy cases improved by **~1.1×–1.4×** due to reduced overhead in the hot path.

When making future changes, add a short entry here (date, high-level description, and benchmark deltas) so we maintain a clear history of how the router has evolved.
