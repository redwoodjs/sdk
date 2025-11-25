[33mcommit c7d4cfb83ee77b4bec489b6fd043816357b07f0f[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;33mtag: [m[1;33mv1.0.0-beta.33[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Author: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>
Date:   Mon Nov 24 20:43:24 2025 +0000

    chore(release): 1.0.0-beta.33

[33mcommit d9023b7275834f4820f0ff4654623373f43b0a5b[m
Author: Justin van der Merwe <justinvderm@gmail.com>
Date:   Mon Nov 24 22:42:10 2025 +0200

    fix: Fix font loading 404s in production (#903)
    
    ## Problem
    
    CSS `@import` for fonts (like `@fontsource/figtree`) works great in dev but falls over in production. The build puts the font files into `dist/worker/assets` instead of `dist/client/assets`, so the browser gets a 404 when trying to load them.
    
    We had a similar issue with CSS files before, which is why we have the `moveStaticAssetsPlugin` to shuffle `.css` files over to the client build. But it was too picky and only looked for CSS files.
    
    ## Solution
    
    I've updated `moveStaticAssetsPlugin` to be less picky. It now moves **all** static assets (except for `.js` and `.map` files) from the worker build to the client build.
    
    This means any asset referenced by CSS—fonts, images, whatever—that ends up in the worker bundle will now get moved to the client distribution where it belongs.
    
    ## Context & Future Investigation
    
    The `moveStaticAssetsPlugin` was originally a bit of a patch to handle CSS file generation during the worker build. While this change gets fonts working, it points to a bigger architectural question about how we handle assets across the split `worker`+`client` environments.
    
    In a perfect world, we wouldn't need to manually shuffle assets around like this. It's worth investigating if we can get the deploy step to look at both `dist/worker` and `dist/client` for assets.
    
    I do remember trying to get all the assets to output to a single directory, but that route proved to be tricky in practice. I think it was partly the challenge of one env clearing the other env's assets (among other challenges) thought I could be misremembering.

[33mcommit 02491080de32836fad8059e5655984ca4740a98e[m
Author: justinvdm <justinvderm@gmail.com>
Date:   Mon Nov 24 21:31:45 2025 +0200

    docs: Bring back dev worklow contrib docs

[33mcommit 6fdf2bb2ee6d69e2945f44fa03dccf767b7e56d4[m[33m ([m[1;33mtag: [m[1;33mv1.0.0-beta.32[m[33m, [m[1;31morigin/figtree[m[33m)[m
Author: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>
Date:   Sun Nov 23 19:23:25 2025 +0000

    chore(release): 1.0.0-beta.32

[33mcommit d46b5ca3a4741885ed3ae86ae65fc49704d86bac[m
Author: Gavin <gavinchingy@gmail.com>
Date:   Sun Nov 23 11:21:57 2025 -0800

    feat: Update `renderToString` options to include all `renderToStream` options
    
    ## Problem
    * `renderToString` does not take in all options for `renderToStream`, in this case for now, `ssr`
    
    ## Solution
    * Use `RenderToStreamOptions` instead and omit `onError`

[33mcommit e53f338d5ff23d79fbbc5291b115a6d00a3ef45f[m
Merge: 0b13b5e7 d55ad33d
Author: Peter Pistorius <peter.pistorius@gmail.com>
Date:   Sun Nov 23 07:48:20 2025 +0200

    Merge pull request #898 from valscion/patch-1
    
    Fix type hover for routers triggering wrong Markdown formatting

[33mcommit d55ad33d6fca834c4b1a26e6d425f8eb30394d6d[m
Author: Vesa Laakso <482561+valscion@users.noreply.github.com>
Date:   Fri Nov 21 14:30:57 2025 +0200

    Fix type hover for routers triggering wrong Markdown formatting
    
    The type hover signature in e.g. VS Code treats the text as markdown and thus the `*, /api/*` part is considered to be `<em>, api/</em>` unless the `*` is escaped.

[33mcommit 0b13b5e7fe60437bf9fba15571709885290359f1[m[33m ([m[1;33mtag: [m[1;33mv1.0.0-beta.31[m[33m)[m
Author: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>
Date:   Fri Nov 21 08:34:23 2025 +0000

    chore(release): 1.0.0-beta.31

[33mcommit 60542fc009f9b18b522643706a201e10e12c0782[m
Author: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Date:   Fri Nov 21 10:32:52 2025 +0200

    chore(deps): update starter-peer-deps (#892)
    
    Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

[33mcommit 7761b08b8dd3a5193aa06ff696bcd8c05ce0a3c1[m
Author: justinvdm <justinvderm@gmail.com>
Date:   Fri Nov 21 10:10:03 2025 +0200

    fix: Remove debugging log remnants

[33mcommit 7497ec1af433b0ffb3fe2ec2c1836c5f86d44cd0[m
Merge: b757accf 7bb632dd
Author: Peter Pistorius <peter.pistorius@gmail.com>
Date:   Thu Nov 20 23:35:44 2025 +0200

    Merge pull request #884 from redwoodjs/pp-test-use-synced-state
    
    Playground for use-sync-state

[33mcommit 7bb632ddb21356c608c0f3b31a23e62ad2645161[m[33m ([m[1;31morigin/pp-test-use-synced-state[m[33m)[m
Author: Peter Pistorius <peter.pistorius@gmail.com>
Date:   Thu Nov 20 23:18:52 2025 +0200

    Fix e2e.

[33mcommit b757accf60d0f4b5f7580d2e04b173be26a26db7[m
Author: Justin van der Merwe <justinvderm@gmail.com>
Date:   Thu Nov 20 23:02:46 2025 +0200

    fix: resolveId race condition with CF vite plugin 1.15.0 (#897)
    
    ## Problem
    
    We encountered an intermittent `Error: rwsdk: 'react-server' is not supported in this environment` failure in CI, particularly with larger libraries like Mantine.
    
    Investigation revealed a race condition when using RedwoodSDK with `@cloudflare/vite-plugin` v1.15.0. The plugin now dispatches a request to the worker entry during `configureServer` to detect exports. This dispatch occurs while our [internal directive scanner](https://github.com/redwoodjs/sdk/blob/e942d025ef8e04a56b56df364701e828729174da/docs/architecture/directiveScanningAndResolution.md) is still running (which runs with `enforce: 'pre'`).
    
    Previously, our plugins were configured to skip `resolveId`, `load`, and `transform` hooks by looking at an env var we set/unset at the start/end of our directive scanner run, to improve scanning performance. However, because Cloudflare's early dispatch happens *during* this scan, our plugins were skipping resolution for critical modules like `rwsdk/__ssr_bridge`. This caused Vite to fall back to standard node resolution, which matched the `react-server` condition in `package.json`, loading a file designed to throw an error in the worker environment.
    
    ## Solution
    
    We've changed how plugins distinguish between our internal directive scan and external requests:
    
    1.  **Custom Option for `resolveId`**: Instead of a global environment variable, `createViteAwareResolver` (used by our scanner) now passes a custom option: `options.custom.rwsdk.directiveScan`.
    2.  **Updated Plugins**: `resolveId` hooks in our plugins (`ssrBridgePlugin`, `knownDepsResolverPlugin`, etc.) now check this custom option. If present, they skip logic for performance. If absent (e.g., during Cloudflare's early dispatch), they proceed normally, ensuring `rwsdk/__ssr_bridge` is correctly resolved to its virtual ID.
    3.  **Removed Skip for `load`/`transform`**: We removed the skip logic entirely for `load` and `transform` hooks. Since our directive scanner uses `esbuild` directly (bypassing Vite's plugin container for these steps), these hooks are only ever called by Vite's normal processing. Skipping them risked caching incorrect "undefined" results if triggered during the scan window.
    4.  **Improved Error Messaging**: We separated the error file for `rwsdk/__ssr_bridge` to provide a specific error message indicating a resolution bug, distinguishing it from generic `react-server` condition mismatches.

[33mcommit b1dd54913a0999518f2f5baad6c90f6998e54042[m
Author: Justin van der Merwe <justinvderm@gmail.com>
Date:   Thu Nov 20 17:14:43 2025 +0200

    fix: CSS module processing error during Cloudflare plugin export detection (#896)
    
    ## Problem
    Cloudflare Vite plugin v1.15.0 dispatches a request to the worker during `configureServer` to detect exports. 