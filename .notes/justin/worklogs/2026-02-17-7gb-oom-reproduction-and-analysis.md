# Reproduction of 7GB OOM in Przm (2026-02-17)

## Initial assessment of the 7GB OOM in DirectiveScan
We started the session with the goal of reproducing a reported 7GB OOM issue in the `DirectiveScan` process within the `przm` codebase. The existing logs indicated that the scanner was exhausting memory on CI runners, likely due to the complexity of the dependency graph and the high volume of file reads. We decided to bridge the gap between synthetic tests and the real project by instrumenting the scanner and running it directly on the `przm` source.

## Created synthetic stress test and identified Lucide-React fan-out
To isolate the memory pressure, we first created a playground stress test. We discovered that a single import from `lucide-react` (specifically `dynamicIconImports`) triggers a "fan-out" effect, where `esbuild` is forced to resolve and scan over 1,600 individual icon files. This demonstrated how a small number of imports could result in a massive expansion of the dependency graph, providing a clear lead for the memory exhaustion.

## Instrumented DirectiveScan with high-resolution memory logging
We added per-second "Memory Ticks" to the `runDirectivesScan.mts` core logic in the SDK. This instrumentation logs `rss`, `heapUsed`, and `heapTotal` frequently, allowing us to see memory spikes that occur between standard progress logs. We also added a `scanStats` object to track total files read, cache size, total bytes read, and "races" (instances where multiple parallel reads were triggered for the same file).

## Reproduced nearly 1GB RSS spike on the Przm project
We set up a debug script, `debug-przm.mjs`, located in the `przm` repository. This script resolves the production Vite configuration (with bypassed database plugins) and runs the `runDirectivesScan` function using all 626 source files as entry points simultaneously. During execution, we observed a massive jump in memory usage: **RSS spiked from 361MB to 821MB in a single tick**, while the V8 Heap stayed consistently low (~31MB-50MB). This confirmed that the memory pressure is not originating from leaked JavaScript objects, but from native buffers and the underlying `esbuild` process handling a massive, redundant graph.

## Identified the "Multiplier Effect" and path resolution as the root cause
Our findings strongly point to a "Multiplier Effect" where the interaction between `esbuild`'s native resolution and our custom `createViteAwareResolver` results in duplicate processing of the same physical files under different path strings.
- **Races**: The scanner was triggering redundant `fs.readFile` calls for the same file before the first call could be cached.
- **Divergent Paths**: Subtle differences in path casing (on macOS) or symlink resolution cause the same dependency to be treated as unique, multiplying the memory required to store file contents in the `fileContentCache`.
- **Barrel Fan-out**: The combination of `lucide-react`'s massive barrel exports and our lack of a effective blocklist (which we disabled for this test) allows the graph to bloat uncontrollably.
