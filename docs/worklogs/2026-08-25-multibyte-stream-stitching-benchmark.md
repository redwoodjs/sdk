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

## After internal text-stream refactor

Two runs after changing the private application streams from bytes to text:

| Scenario             | Mean, run 1 | Mean, run 2 | Focused-fix average | Change |
| -------------------- | ----------: | ----------: | ------------------: | -----: |
| Small ASCII page     |   0.0722 ms |   0.0713 ms |           0.0765 ms |  -6.1% |
| 100 multibyte rows   |   0.3628 ms |   0.3586 ms |           0.3756 ms |  -4.0% |
| 2,000 multibyte rows |   7.5457 ms |   7.4239 ms |           7.5534 ms |  -0.9% |

The refactor removes one application text-to-bytes-to-text conversion and is
slightly faster in these runs. Output sizes remained 610, 4,721, and 93,122
bytes, each response still used seven output chunks, and all profiles reported
zero replacement characters. One-off first-chunk timings remained dominated by
React stream startup and showed no consistent delay attributable to stitching.

## Local production validation

The `meta-hoisting` playground was built with `vite build` and served through
Vite's local production preview. No Cloudflare deployment was used.

The local response returned HTTP 200 with 20,414 bytes, contained both customer
1 and customer 100 with intact bullets, and contained zero decoded replacement
characters and zero `EF BF BD` replacement-character byte sequences.

After the internal text-stream refactor, the same local build and preview check
returned HTTP 200 with 20,462 bytes. The small size difference comes from newly
generated build asset names and payload data. Customer 1 and customer 100 were
still intact, and the raw response again contained zero `EF BF BD` sequences.

## Validation record

- `cd sdk && pnpm exec vitest --run src/runtime/lib/stitchDocumentAndAppStreams.test.ts`
  - 25 tests passed.
- `cd sdk && pnpm build`
  - TypeScript build passed.
- `cd sdk && pnpm test`
  - 50 files passed; 620 tests passed and 1 was skipped.
- `RWSDK_SKIP_DEPLOY=1 pnpm test:e2e playground/meta-hoisting/__tests__/e2e.test.mts`
  - 2 development tests passed and 1 deployment test was skipped.
- `cd playground/meta-hoisting && pnpm build`
  - Local production build passed.
- `cd playground/meta-hoisting && pnpm preview --host 127.0.0.1 --port 4173`
  - Local response verified manually; no cloud deployment.
- `AI_AGENT=1 npx @redwoodjs/agent-ci run --all`
  - Attempted after the refactor. The workflows could not start because Docker
    was not running. The selected release workflow also requires a
    `GITHUB_TOKEN`. No release, push, or deployment was attempted. We chose not
    to start Docker or provide release credentials for this change.
- `pnpm check`
  - Passed as the Docker-free repository check. This built the SDK, checked the
    addons and starter, built the community package, and checked community
    projects. Wrangler reported that sandbox restrictions prevented writing
    its optional debug logs outside the workspace, but type generation
    completed and the command exited successfully.
