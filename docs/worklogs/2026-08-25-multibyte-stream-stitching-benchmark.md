# Multibyte stream stitching benchmark

## Decision record

Issue #1283 proposes a focused repair: keep each source flowing through its
own decoder, preserve that decoder's state when the stitcher changes phases,
and flush it when the source ends. Commit `2d70b7ed` records that repair and
the regression coverage as an independently usable fallback.

The focused repair is correct, but it makes the app body pass through an
additional text-to-bytes-to-text cycle. The next step is therefore an internal
refactor with this boundary:

```text
document bytes -> document decoder -------------------+
                                                       +-> final encoder -> response bytes
app bytes      -> one app decoder -> app text streams -+
```

The public inputs and output remain byte streams. Only the private app streams
become text. The marker order, metadata hoisting, Suspense ordering, and early
hydration state machine remain unchanged.

This refactor does not sit in the ongoing transport path for React Server
Function streams or Realtime. Server Function responses use the RSC response
path, while Realtime updates use WebSockets. Both features still depend
indirectly on the initial document hydrating successfully, so their protocols
are out of scope but hydration timing remains part of the risk assessment.

### Risks to verify

- Initial app shell, document tail, and suspended content retain their order.
- Metadata is still removed from the app body and inserted into the head.
- A multibyte character can cross a source chunk boundary in every phase.
- Stream errors and cancellation still reach the caller.
- Development and local production output remain correct without a cloud
  deployment.
- Removing the redundant conversion improves the focused benchmark without a
  material delay to the first response chunk.

## Baseline

Recorded before changing `stitchDocumentAndAppStreams` for issue #1283.

Command:

```bash
cd sdk
pnpm exec vitest bench --run src/runtime/lib/stitchDocumentAndAppStreams.bench.ts
```

Environment:

- Node.js 22.22.1
- Vitest 4.1.5
- macOS arm64

Results:

| Scenario             | Operations/second |      Mean | Relative margin of error |
| -------------------- | ----------------: | --------: | -----------------------: |
| Small ASCII page     |         13,131.08 | 0.0762 ms |                   ±3.26% |
| 100 multibyte rows   |          2,631.39 | 0.3800 ms |                   ±3.42% |
| 2,000 multibyte rows |            126.97 | 7.8760 ms |                   ±5.20% |

One-off stream profiles:

|            Rows |  Bytes | Output chunks | First chunk |    Total |
| --------------: | -----: | ------------: | ----------: | -------: |
|        10 ASCII |    610 |             7 |    5.764 ms | 5.857 ms |
|   100 multibyte |  4,721 |             7 |    5.731 ms | 5.823 ms |
| 2,000 multibyte | 93,122 |             7 |    5.589 ms | 7.164 ms |

The benchmark uses React's `renderToReadableStream` for both inputs. The full
RedwoodSDK development E2E reproduction remains the correctness check because
that RSC-to-HTML pipeline naturally places a chunk boundary inside the first
bullet in customer row 42.

## After continuous decoding fix

Two fresh runs after commit `2d70b7ed` produced:

| Scenario             | Mean, run 1 | Mean, run 2 | Baseline mean |
| -------------------- | ----------: | ----------: | ------------: |
| Small ASCII page     |   0.0778 ms |   0.0751 ms |     0.0762 ms |
| 100 multibyte rows   |   0.3784 ms |   0.3727 ms |     0.3800 ms |
| 2,000 multibyte rows |   7.5405 ms |   7.5663 ms |     7.8760 ms |

An earlier post-fix run reported means of 0.1239 ms, 0.5690 ms, and
12.8088 ms. That apparent 50–63% regression did not repeat and is treated as a
transient machine-load result rather than evidence of a code regression.

Output byte sizes and chunk counts stayed unchanged. The 100-row development
E2E response no longer contains a Unicode replacement character. Repeated
measurements will also be used for the text-stream refactor comparison.

## Local production validation

The `meta-hoisting` playground was built with `vite build` and served through
Vite's local production preview. No Cloudflare deployment was used.

The local response returned HTTP 200 with 20,414 bytes, contained both customer
1 and customer 100 with intact bullets, and contained zero decoded replacement
characters and zero `EF BF BD` replacement-character byte sequences.
