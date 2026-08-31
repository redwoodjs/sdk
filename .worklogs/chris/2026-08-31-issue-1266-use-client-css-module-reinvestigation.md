# Issue #1266 — restart the client-component CSS Module investigation

## Established the goal and evidence standard

We are investigating RedwoodSDK issue #1266 from a clean branch based on the latest upstream `main`. The report says that, during development, a CSS Module imported directly by a `"use client"` component loses its class-based styling after we edit the CSS file and reload the page. A plain `body` selector remains styled. We must first show this failure with raw output, then identify the cause, make the smallest focused repair, and run the identical example again to show that the repair changes the result.

We will keep the earlier worktree at `/Users/chris/rw/worktrees/sdk_1266-use-client-styling-loss` unchanged. Its worklog is background only. Its claim that the server-side rendering environment holds an old CSS class mapping remains a hypothesis until this investigation produces matching evidence.

## Read the available project guidance and issue report

We read the repository `AGENTS.md` target, `CLAUDE.md`, and `.docs/blueprints/overview.md`. The blueprint says RedwoodSDK composes several Vite plugins and handles `"use client"` modules differently across its browser, server-rendering, and React Server Component environments. The repository requires `AI_AGENT=1 npx @redwoodjs/agent-ci run --all` before we report completion.

The internal guidance repository named in the session instructions was not present at `/Users/chris/rw/internal-prompts`, so no additional local internal document was available there. We also read the complete public issue through GitHub. It reports RedwoodSDK 1.5.9 with Vite approximately 8.1.0 and gives this sequence: start development mode, edit a CSS Module imported directly by a `"use client"` component, and reload the page. The expected result is that all styling remains; the reported result is that the generated class styling disappears while a plain `body` rule remains.

## Moved the clean investigation branch to current upstream main

We fetched `upstream/main` and fast-forwarded the current clean branch `cn-css-styling-1266` from `c11782f66824fab6932f4bde30f4c5956c994d6d` to `4fdfe5636b34a9d917570d4321fc05422326ffd3`. The latter commit is current upstream `main` and carries the release label in its subject, `chore(release): 1.7.2`. We did not create another worktree after agreeing to continue in the existing clean one.

## Planned the autonomous investigation

Objective: reproduce issue #1266 on current `main`, explain the observed mechanism from direct evidence, and make the smallest repair that preserves CSS Module styling after the reported edit-and-reload sequence.

Evidence plan: we will inspect current development-server and test helpers, create the smallest official playground that contains one client component and one CSS Module, and automate a browser check that records the rendered class name, computed class-based style, plain `body` style, and development-server output before and after editing the CSS file and reloading. We will run this unchanged example before editing SDK source. If it passes, we will compare the example with the issue setup and vary only evidence-backed details until it matches the report or we can show that current upstream behavior already differs.

Proposed approach: after reproduction, we will trace which Vite environment retains the old CSS data by inspecting module invalidation and, where needed, adding temporary logging. We will tie the smallest source change to that evidence, remove temporary logging, and add a focused automated regression test.

Verification: we will run the same browser example after the repair and capture its raw output, then run nearby SDK tests and `AI_AGENT=1 npx @redwoodjs/agent-ci run --all`. We will resolve ordinary local failures that block this proof.

Scope boundaries: we will change only files needed for issue #1266. We will not incorporate unrelated work from the earlier worktree, merge, or push.

## Hit a runtime and dependency hurdle before the reproduction ran

We added the first reproduction check to the existing `playground/css` example because it already contains the minimum reported shape: one `"use client"` component directly imports one CSS Module. The check writes a blue class background and a gray plain `body` background, loads the page, records both computed styles and the generated class name, changes only the class background to green, reloads, and records the same values again. A `finally` block restores the CSS file after the test.

The first command did not reach SDK compilation or browser execution:

```text
$ pnpm --filter rwsdk build && RWSDK_SKIP_DEPLOY=1 pnpm test:e2e playground/css/__tests__/e2e.test.mts
[WARN] Unsupported engine: wanted: {"node":">=24.14.0"} (current: {"node":"v22.22.1","pnpm":"11.18.0"})
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY
If you are running pnpm in CI, set the CI environment variable to "true", or set "confirmModulesPurge" to "false".
```

This output cannot prove or disprove issue #1266 because the example never ran. Current upstream `main` requires Node 24.14 or later, but the active shell supplies Node 22.22.1. The fast-forward also changed the workspace dependency layout, so pnpm needs to replace the existing dependency directory. We will align the runtime and reinstall non-interactively before repeating the unchanged reproduction.

## Corrected two reproduction-harness mistakes

We installed Node 24.20.0 through the existing local Node version manager and ran the locked dependency install successfully. The next harness attempt exposed two mistakes in our check rather than SDK behavior. First, CSS Modules replace `.container` with a generated class such as `_container_yaxpn_1`, so waiting for a literal `.container` element could never succeed. Second, writing the initial blue CSS after the development server had started turned test setup into an extra hot update and allowed the server to cache the original playground CSS first.

We corrected the example by making blue the checked-in initial class background, adding the gray `body` rule to the same CSS Module, selecting the component by its stable place under `#hydrate-root`, and making green the only file edit during the test. We also ask browser navigation to wait only until the HTML is loaded, which matches the reported full-page reload and avoids treating unrelated long-running browser work as part of this assertion. These changes affect only the example and its measurement; SDK source remains unchanged.

## Reproduced issue #1266 on unmodified current main

We ran only the focused development check against SDK commit `4fdfe5636b34a9d917570d4321fc05422326ffd3`. The harness retries failed assertions ten times. The first attempt read styles before the stylesheet had settled, so its transparent values are setup noise. Attempts 2 through 10 all established the blue starting state. After the CSS edit and reload, seven attempts kept the old blue class style and two attempts lost the class style entirely. Every attempt kept the plain gray `body` style. Representative raw output:

```text
issue-1266 before CSS edit {
  bodyBackground: 'rgb(240, 240, 240)',
  className: '_container_169nf_5',
  containerBackground: 'rgb(0, 0, 255)'
}
issue-1266 after CSS edit and reload {
  bodyBackground: 'rgb(240, 240, 240)',
  className: '_container_169nf_5',
  containerBackground: 'rgba(0, 0, 0, 0)'
}
```

The last retry showed the more common stale-style result:

```text
- Expected
+ Received
  {
    "bodyBackground": "rgb(240, 240, 240)",
-   "containerBackground": "rgb(0, 128, 0)",
+   "containerBackground": "rgb(0, 0, 255)",
  }

Test Files  1 failed (1)
Tests  1 failed | 3 skipped (4)
Duration  38.90s
```

This proves that current RedwoodSDK `main` does not deliver the edited class rule after the reported edit-and-reload sequence while it continues to deliver the plain selector. It does not yet prove why. We will now trace the update across the worker, server-rendering, and browser module stores and compare the generated class mappings and served CSS.

## Confirmed that live CSS updates but the reload renders the old class

We tightened the reproduction so it waits for the open page to turn green before reloading. This separates a working browser hot update from the failing server-rendered reload. With one retry and development logging enabled, the sequence was exact:

```text
issue-1266 before CSS edit {
  bodyBackground: 'rgb(240, 240, 240)',
  className: '_container_169nf_5',
  containerBackground: 'rgb(0, 0, 255)'
}
issue-1266 after CSS edit before reload {
  bodyBackground: 'rgb(240, 240, 240)',
  className: '_container_1hnms_5',
  containerBackground: 'rgb(0, 128, 0)'
}
issue-1266 after CSS edit and reload {
  bodyBackground: 'rgb(240, 240, 240)',
  className: '_container_169nf_5',
  containerBackground: 'rgba(0, 0, 0, 0)'
}
```

The browser hot update changed both the generated class name and its matching CSS from blue to green. The full reload then returned server-rendered HTML with the old `_container_169nf_5` class while the browser retained CSS for the new `_container_1hnms_5` class. React reported the same disagreement:

```text
<div
+ className="_container_1hnms_5"
- className="_container_169nf_5"
>
```

The development log also shows that the server-rendering environment received the CSS event and invalidated the CSS module:

```text
rwsdk:vite:hmr-plugin SSR update, invalidating recursively .../Welcome.module.css
rwsdk:vite:hmr-plugin hmr: invalidated ssr module
```

The code behind that message invalidates the CSS node itself but does not ask Vite to invalidate modules that imported it. The worker also holds a virtual copy of the server-rendered CSS module. The evidence fits a narrower cause than the earlier general cache hypothesis: the changed leaf is marked stale, but the already-evaluated client component above it remains cached and continues returning its original class mapping during server rendering.

We will test the smallest reversible change first: when the server-rendering CSS event invalidates the worker's virtual CSS module, also invalidate its importers. If the same browser check turns green after reload, that establishes that the stale worker import chain is necessary for the failure. If it does not, we will remove the experiment and inspect the exact graph IDs before trying another path.

## Rejected recursive invalidation against the existing target

The first experiment still returned the old server class and failed the identical browser check:

```text
issue-1266 after CSS edit before reload {
  className: '_container_1hnms_5',
  containerBackground: 'rgb(0, 128, 0)'
}
issue-1266 after CSS edit and reload {
  className: '_container_169nf_5',
  containerBackground: 'rgba(0, 0, 0, 0)'
}
```

The attempted recursion could not help because the server-rendering branch targets `virtual:rwsdk:ssr:<path>.css`, while `ssrBridgePlugin.mts` deliberately resolves every virtual CSS module to `virtual:rwsdk:ssr:<path>.css.js`. The later worker-update branch already adds this `.js` suffix before looking up the same kind of module. Therefore, the server-rendering branch has been asking `invalidateModule` for an ID that is not the worker module graph's CSS node.

We will retain recursive importer invalidation but correct the target to the actual `.css.js` ID. Correcting only the suffix would mark the virtual CSS leaf stale, but the observed stale value lives in an already-evaluated component above that leaf; recursion makes Vite discard that cached component too.

## Made the identical reproduction pass by invalidating the actual worker module

We changed the server-rendering update branch to add the `.js` suffix for CSS, matching `ssrBridgePlugin.mts`, and to invalidate the virtual CSS module's importers. We built the SDK and ran the same focused browser check with one attempt. Raw result:

```text
rwsdk:vite:hmr-plugin SSR update, invalidating recursively .../Welcome.module.css
rwsdk:vite:hmr-plugin hmr: invalidated ssr module
[vite] (client) hmr update /src/app/pages/Welcome.tsx

Test Files  1 passed (1)
Tests  1 passed | 3 skipped (4)
Duration  21.23s
```

The browser check still requires the live component to become green before reload and requires the reloaded component to remain green, while the plain `body` rule remains gray. Passing therefore proves that the corrected target changes the failing end-to-end outcome, not merely that the development server accepted the file event.

We added a unit test which invokes the same plugin hook as the `ssr` environment and checks both invalidation calls. It requires the worker target to be `virtual:rwsdk:ssr:/styles.module.css.js` and requires recursive importer invalidation. This makes the filename rule and the reason for clearing the parent chain explicit without depending only on the browser test.

## Passed focused and nearby automated checks

The focused plugin test passed:

```text
$ cd sdk && pnpm test src/vite/miniflareHMRPlugin.test.mts
Test Files  1 passed (1)
Tests  17 passed (17)
Duration  690ms
```

The complete CSS playground file also passed in development mode:

```text
$ RWSDK_SKIP_DEPLOY=1 pnpm test:e2e playground/css/__tests__/e2e.test.mts
[vite] (client) hmr update /src/app/pages/Welcome.tsx
Test Files  1 passed (1)
Tests  2 passed | 2 skipped (4)
Duration  24.29s
```

The two skipped checks exercise deployment and were deliberately excluded with `RWSDK_SKIP_DEPLOY=1`; issue #1266 concerns development updates. Vitest printed `close timed out after 10000ms` after reporting success because a Vite process delayed shutdown, but the command exited with code 0 and explicitly reported `Tests closed successfully`.

The repository Prettier command currently fails inside `prettier-plugin-organize-imports` while it tries to use TypeScript 7.0.2 (`Cannot read properties of undefined (reading 'fileExists')`). We formatted the four touched source and test files with the same Prettier version while disabling that broken import-sorting plugin, then aligned the playground imports with nearby files manually. This is a tooling hurdle rather than a test failure; the required all-check command will show whether the repository's own validation path accepts the result.

## Found a sandbox-only failure in the broad SDK tests

The first full SDK run reported 52 passing files and 646 passing tests. Ten tests in `src/use-synced-state/hibernation/__tests__/client-core.test.ts` failed before their assertions because the restricted command environment denied their local WebSocket listener:

```text
Error: listen EPERM: operation not permitted 0.0.0.0
at new WebSocketServer
Test Files  1 failed | 52 passed (53)
Tests  10 failed | 646 passed | 1 skipped (657)
```

These failures do not execute the changed Vite code and the error identifies the denied local bind directly. We will rerun the same SDK command with local networking permission so the WebSocket tests can establish their fixture server.

## Passed the full SDK unit suite

The same full suite passed once its local WebSocket fixture could bind:

```text
$ cd sdk && pnpm test
Test Files  53 passed (53)
Tests  656 passed | 1 skipped (657)
Duration  2.46s
```

## Agent CI could not find the default Docker socket

We ran the repository-required command exactly under Node 24:

```text
$ AI_AGENT=1 npx @redwoodjs/agent-ci run --all
[Local CI] @redwoodjs/agent-ci has been renamed to the run-local-ci package.
[Local CI] Fatal error: local-ci couldn't use a Docker socket at /var/run/docker.sock.
/var/run/docker.sock is missing or a dangling symlink.
```

The runner says it can use `LOCAL_CI_DOCKER_HOST` instead. We will inspect the active Docker context and known Docker Desktop socket, then rerun the required command against that socket if it exists.

## Ran all available local CI jobs and found host-only blockers

The active Docker context pointed to OrbStack, but OrbStack was not running and `/var/run/docker.sock` was a dangling link to its absent socket. We started the installed OrbStack application, confirmed Docker server version 29.4.0, and reran the required command. Agent CI completed 12 jobs in 19 minutes 18 seconds: 10 passed and two Vite 7 playground jobs failed before test discovery.

Both failures downloaded Chrome into an ARM Linux container and then tried to execute an x86 binary. OrbStack supplied the direct cause:

```text
Error: Failed to launch the browser process: Code: 255
OrbStack ERROR: Dynamic loader not found: /lib64/ld-linux-x86-64.so.2
This usually means that you're running an x86 program on an arm64 OS without multi-arch libraries.
```

The runner summary was:

```text
Status:    ✗ 2 failed, 10 passed (12 total)
Duration:  19m 18s
```

The runner separately declined to schedule the `release` workflow job because it requires `GITHUB_TOKEN`. We will not supply release credentials because this investigation explicitly excludes pushing or publishing. The two executed failures are also outside issue #1266: the same CSS browser test passes with the host's native ARM Chrome, while the failing jobs cannot start their downloaded browser or discover any test file. We will not add OrbStack multi-architecture setup or release credentials to this issue branch.

## Updated the architecture source of truth

We added the verified development behavior to `.docs/blueprints/overview.md`: the SSR bridge represents worker-side CSS as virtual JavaScript ending in `.css.js`, and CSS changes must invalidate that node plus its importers because an evaluated client component holds the generated class map. This records why the suffix and recursion exist so the behavior can be rebuilt without relying on this session.

## Reviewed and closed the implementation work unit

The repair stays inside issue #1266. The SDK change corrects one virtual module ID and its invalidation reach. The existing CSS playground supplies the minimum client-component example and an automated edit-and-reload check. The focused unit test locks down the internal ID, while the browser test proves the visible behavior. We did not copy unrelated changes from the earlier worktree, change dependencies, merge, push, publish, or provide release credentials.

Decisions made:

- We reused `playground/css` instead of adding another project because it already contains exactly one client component importing one CSS Module. This keeps installation and test scope smaller.
- We wait for the live page to adopt the edited green CSS before reloading. This proves the browser received the edit and isolates the stale server-rendered reload from ordinary file-watcher delay.
- We add `.js` only for CSS virtual modules because `ssrBridgePlugin.mts` applies that exact conversion. JavaScript and TypeScript virtual IDs retain their existing names.
- We recursively invalidate worker importers because the stale class map is held by the evaluated component above the CSS leaf. The experiment that added recursion without correcting the ID failed, while suffix correction plus recursion passed the unchanged browser path.

Assumptions:

- The issue's relevant contract is development behavior; deployment checks do not edit source under a running development server.
- The generated CSS class name may vary across tool versions, so the regression test asserts computed colors and records the class name as evidence instead of hard-coding it.

Hurdles encountered:

- Current `main` required Node 24 and a dependency reinstall after the branch fast-forward.
- The first reproduction selected the unhashed source class and wrote setup CSS after server startup; we corrected both harness mistakes before drawing product conclusions.
- Restricted local networking blocked an unrelated WebSocket unit fixture; the identical suite passed with local binding permission.
- Repository Prettier's import plugin crashes with TypeScript 7, so we used Prettier without that plugin and manually preserved nearby import order.
- Agent CI needed OrbStack to start. Ten jobs passed; two browser jobs could not launch an x86 Chrome binary inside an ARM container, and the release job requires credentials we cannot supply under the no-push/no-publish boundary.

Open questions:

- The local-ci browser architecture mismatch remains a machine/tooling problem outside issue #1266. It should be handled separately if we want every playground job to run under ARM OrbStack.
- The release workflow cannot run locally without `GITHUB_TOKEN`; supplying that credential would expand this task beyond its authorization.

Verification proof is recorded in the earlier chronological sections. The last local source checks also passed:

```text
$ git diff --check
(no output)
$ pnpm --filter rwsdk build
$ cd sdk && pnpm test src/vite/miniflareHMRPlugin.test.mts
Test Files  1 passed (1)
Tests  17 passed (17)
Duration  497ms
```

## Recorded the implementation commit

We committed the isolated repair and its evidence artifacts without merging or pushing:

```text
ab84f195 fix(vite): refresh CSS module classes after reload
```
