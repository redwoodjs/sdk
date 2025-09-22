# E2E Test Coverage for Past Regressions and Behaviors

## Problem

The project has recently adopted end-to-end tests within playground examples. The existing smoke tests are not comprehensive enough to cover all critical user-facing behaviors and prevent regressions. There is a need to systematically identify past regressions and behaviors that are not currently covered by tests.

## Plan

1.  Analyze the git history starting from the `v0.2.0` release.
2.  For each commit, identify user-experience regressions, new features, or significant behavior changes.
3.  Document these findings in this work log.
4.  The documented behaviors will serve as a basis for creating new playground examples with end-to-end tests, ensuring these cases are covered moving forward.

## Analysis

### `e0f5087cbb4cb6c82de21d02824fc6c1e950900`

- **Summary**: `chore: Fix release script for prerelease to actual release`
- **Impact**: No user-facing impact.
- **Analysis**: This commit modifies the release script. It does not affect the runtime behavior of the SDK. No test is needed.

### `0f7ba26a939eaa80f907d4883e50d2d55e0f989a`

- **Summary**: `refactor(sdk): Overhaul production build and dev server optimization`
- **Impact**: Major user-facing impact on build process and directive handling.
- **Analysis**: This commit introduces a multi-pass build system and formalizes the use of "use client" and "use server" directives. It's a foundational change with several testable user-facing behaviors.
- **Behaviors to test**:
    - **Unused Client Component Tree-Shaking**: Verify that a client component not imported or used by any server-rendered page is not included in the production client bundle. This ensures users don't ship dead code to the browser.
    - **Server Actions (`"use server"`)**: Create a test where a client component calls a function from a module marked with `"use server"`. The test should invoke the action and assert that it executes successfully on the server and returns the expected result.
    - **Custom Client Entry points**: Test that a custom script included via a `<script>` tag in `Document.tsx` (e.g., `<script src="/my-analytics.js">`) is correctly identified, bundled, and included in the production output.
    - **Dev Server Stability**: While not a specific feature, the refactoring impacts the dev server. The successful execution of any playground e2e test against the dev server implicitly validates that these optimizations haven't broken its fundamental behavior.

### `43781110695adadab382dc1eedd5e19a8c650e13`

- **Summary**: `Merge branch 'stable'`
- **Impact**: None.
- **Analysis**: This is a merge commit and introduces no new behavior. No test is needed.

### `d01b08c7ae09097d89de1d6a9ad992f0f2bef80c`

- **Summary**: `chore: Remove now-unused clientNavigation.ts`
- **Impact**: None.
- **Analysis**: This commit removes a file that was left over from a merge conflict. It's a code cleanup task with no change in functionality. No test is needed.

### `4d00a53ba80d01b3463a24408f908bfaa4796a1f`

- **Summary**: `chore(release): 0.3.0`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.0` release. The significant user-facing changes included in this version were introduced in commit `0f7ba26a939eaa80f907d4883e50d2d55e0f989a` (the build system overhaul). No new behaviors are introduced in this specific commit.

### `2d149e5b887d0dfad7cb8de2f8953d3e9a9b6568`

- **Summary**: `💬 Minor tweaks to the tutorial`
- **Impact**: None.
- **Analysis**: This commit contains only documentation changes for the tutorial. It has no effect on the SDK's behavior. No test is needed.

### `04f49240a99acbb8e1827e6edddc16cbb3b42603`

- **Summary**: `✨ Created a GitHub Action for Notifying me of changes made to the tutorial (#670)`
- **Impact**: None.
- **Analysis**: This commit adds a GitHub Action to notify about documentation changes. It is a repository/CI change and has no impact on the SDK's runtime behavior. No test is needed.

### `3ac8e6725ef900f558895a9338c1c02e3e97c7b6`

- **Summary**: `💬 Tweaked tutorial for clarity`
- **Impact**: None.
- **Analysis**: This commit contains only documentation changes for the tutorial. It has no effect on the SDK's behavior. No test is needed.

### `b311d82d49cc7bcb002fa89bb6765f12b01eff1f`

- **Summary**: `fix: Use vite plugins when scanning for directives (#671)`
- **Impact**: High. Fixes a critical bug with module resolution for projects using path aliases. Improves dev server startup experience.
- **Analysis**: This commit fixes a bug where the directive scanner could not resolve modules using Vite plugin-based path aliases (like TypeScript's `@/*`). It also refactors the dev server startup to be non-blocking, improving perceived performance.
- **Behaviors to test**:
    - **Path Alias Resolution**: A playground e2e test should be created that uses a TypeScript path alias (e.g., `import C from '@/components/C'`) to import a client component. The test must verify the component is correctly bundled and rendered, confirming that the directive scanner respects Vite plugins like `vite-tsconfig-paths`.

### `28051e013947d6e443f9aba44a584015346b7071`

- **Summary**: `chore(release): 0.3.1`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.1` release. The key user-facing change included in this version is the fix for path alias resolution in the directive scanner, which was introduced in the preceding commit. No new behaviors are introduced in this specific commit.

### `4c7be33c02a3dfa0d27cabeaa8859e0e40826907`

- **Summary**: `fix: Directive scanner compatibility with vite 7 (#673)`
- **Impact**: High. Ensures the SDK is compatible with Vite 7.
- **Analysis**: This commit fixes a crash in the directive scanner when used with Vite 7. It makes the scanner's module resolver compatible with Vite 7's updated plugin architecture. The primary user impact is that projects using Vite 7 will no longer crash during development server startup or production builds.
- **Behaviors to test**:
    - **Vite 7 Compatibility**: This is a compatibility fix, not a new feature. The successful execution of other e2e tests (especially the "Path Alias Resolution" test) on a project using Vite 7 would be the validation for this change. It ensures the directive scanning system remains robust across Vite versions.

### `3e3a5fa0ab30c5942f6b7177a96bb5748722af9c`

- **Summary**: `chore(release): 0.3.2`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.2` release, which includes the Vite 7 compatibility fix for the directive scanner from the preceding commit. No new behaviors are introduced in this specific commit.

### `4d3ebb28f0910cae022eaa4462d62562422583c3`

- **Summary**: `fix: Respect server and client environments when scanning for directives (#675)`
- **Impact**: High. Fixes a critical bug in module resolution for libraries with conditional exports.
- **Analysis**: This commit makes the directive scanner context-aware. It now dynamically switches its module resolution strategy based on whether it's inside a "use client" or "use server" branch of the dependency tree. This is crucial for correctly bundling third-party packages that provide different builds for the client and server (using conditional exports).
- **Behaviors to test**:
    - **Conditional Export Resolution**: Create a playground e2e test where a client component imports a third-party npm package that uses conditional exports (e.g., has different "browser" and "react-server" entry points in its `package.json`). The test must verify that the correct (browser) version of the package is resolved and bundled for the client, preventing build failures.

### `ebc32d1f696aba46338245a1541543d710e14994`

- **Summary**: `chore(release): 0.3.3`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.3` release. It includes the fix for context-aware directive scanning, ensuring correct module resolution for packages with conditional exports. No new behaviors are introduced in this specific commit.

### `9ead2cac1251e9982dcd29205dfbd7a16d4580f7`

- **Summary**: `Add scanner arch docs page to index`
- **Impact**: None.
- **Analysis**: This is a documentation change that updates the architecture index. It has no effect on the SDK's behavior. No test is needed.

### `6533e34fd25ada65d125489135f9d904c4b512ec`

- **Summary**: `fix: Store module env correctly in directive scanner`
- **Impact**: Medium. Corrects a regression in the context-aware directive scanner.
- **Analysis**: This commit fixes a bug where a module's own directive (`"use client"` or `"use server"`) was not being prioritized over the environment inherited from its importer. This ensures the scanner's context-switching is robust.
- **Behaviors to test**: The test case for "Conditional Export Resolution" is sufficient to cover this correction. It ensures the context-aware scanning works as intended.

### `aec5c8b748a7d721c49945c680cbec074224d0a8`

- **Summary**: `chore(release): 0.3.4`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.4` release, which includes the bugfix for the directive scanner's environment caching. No new behaviors are introduced in this specific commit.

### `fc95a16d673bb7ae886d9068cdf759267e83a4df`

- **Summary**: `fix: Use more complete client resolver (#678)`
- **Impact**: High. Fixes a bug where path aliases would not work within client components.
- **Analysis**: This commit refines the context-aware directive scanner. It now uses the full Vite configuration for the client environment when resolving modules downstream of a `"use client"` directive. The previous implementation was minimal and missed important settings like path aliases.
- **Behaviors to test**:
    - **Path Aliases in Client Components**: An e2e test should be created where a client component, which is itself rendered by a server component, uses a path alias (e.g. `@/utils/helpers`) to import another module. The test must confirm that the alias is resolved correctly and the component functions, validating that the scanner respects the full client resolution configuration after switching contexts.

### `f02f98e7c3208d733f07770c275468ffc265ffb3`

- **Summary**: `chore(release): 0.3.5`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.5` release. It includes the fix to ensure the directive scanner uses the full client environment configuration, making path aliases work correctly within client components. No new behaviors are introduced in this specific commit.

### `9767b1dc1bed50add2ccd0ba30a6839ddc583044`

- **Summary**: `feat: Support importing SSR-based dependencies in worker env (#679)`
- **Impact**: High. Enables the use of server-side libraries that depend on `react-dom/server`.
- **Analysis**: This commit introduces a new `resolveSSRValue` API. It provides a mechanism for server components (RSC) to call functions that exist in the SSR environment. This is a workaround for the React limitation that prevents libraries using `react-dom/server` (like email templating libraries) from being used directly in the RSC worker environment.
- **Behaviors to test**:
    - **`resolveSSRValue` for SSR-only Libraries**: Create an e2e test that simulates sending an email or rendering an email template. A server action should use `resolveSSRValue` to call a function defined in a `"use client"` module, which in turn uses a library dependent on `react-dom/server` (e.g., `@react-email/render`). The test must verify that the action executes successfully without runtime errors.

### `907711835dd1c8bf88a75c07ad3875b1634c9eb2`

- **Summary**: `chore(release): 0.3.6`
- **Impact**: None (Release Marker).
- **Analysis**: This commit marks the `v0.3.6` release, which includes the new `resolveSSRValue` API for using SSR-dependent libraries in the worker environment. No new behaviors are introduced in this specific commit.

### `0d80b2c665c5819ca2c7cf7beec2d508740a2042`

- **Summary**: `docs: Remove broken diagram`
- **Impact**: None.
- **Analysis**: This is a documentation change that removes a broken diagram. It has no effect on the SDK's behavior. No test is needed.

### `6923ff788dc41ae38a33e747c67d5aa653d587e5`

- **Summary**: `add import`
- **Impact**: None.
- **Analysis**: This is a documentation change that adds a missing import to a tutorial code sample. It has no effect on the SDK's behavior. No test is needed.

### `bca33395699666d64e61cabc318897d51603a4b3`

- **Summary**: `use layout function instead of wrapping the components in a LayoutComponent`
- **Impact**: None.
- **Analysis**: This is a documentation change that refactors the tutorial to use a router `layout` function. It has no effect on the SDK's behavior. No test is needed.

### `da854ba073e4ca7af827fb15eb9abd2222267915`

- **Summary**: `Merge pull request #672 from redwoodjs/ad-docs-applywize-review`
- **Impact**: None.
- **Analysis**: This is a merge commit for documentation changes. It has no effect on the SDK's behavior. No test is needed.

### `865c7113ca8616afd55db704524ba54fa7d9aab6`

- **Summary**: `📝 Auth review`
- **Impact**: None.
- **Analysis**: This is a documentation change that reviews and updates the auth tutorial. It has no effect on the SDK's behavior. No test is needed.

### `d33c244f43c8f1e7faddbffbbaec9d4b90434888`

- **Summary**: `dev: 1.0 Planning notes`
- **Impact**: None.
- **Analysis**: This commit adds internal planning and triage notes for the 1.0 release. It has no effect on the SDK's behavior. No test is needed.

### `3e8b19de216d2e265ae41c4d05a690cc140da295`

- **Summary**: `Merge branch 'main' into ad-docs-applywize-review-part-2`
- **Impact**: None.
- **Analysis**: This is a merge commit for documentation. It has no effect on the SDK's behavior. No test is needed.

### `f9e7a10658553b37e2bbf8d405a14b43bc816d9c`

- **Summary**: `Merge branch 'main' of https://github.com/redwoodjs/reloaded into docs-fixes`
- **Impact**: None.
- **Analysis**: This is a merge commit for documentation. It has no effect on the SDK's behavior. No test is needed.

### `58d5eb3a78792bdc882cf9427b6a846bfe15af39`

- **Summary**: `Merge branch 'ad-docs-applywize-review-part-2' into docs-fixes`
- **Impact**: None.
- **Analysis**: This is a merge commit for documentation. It has no effect on the SDK's behavior. No test is needed.

### [a106b2cca89fbc6c1eb62bbe32d27882e234379d](https://github.com/redwoodjs/redwood-sdk/commit/a106b2cca89fbc6c1eb62bbe32d27882e234379d)

- **Summary**: `chore(deps): Bump docs dependencies`
- **Impact**: None. This is an internal dependency update for the documentation site.
- **Analysis**: No user-facing impact.
- **Behaviors to Test**:
  - None.

### [e420822c62ac6d07c20f01078e2620899415e3a7](https://github.com/redwoodjs/redwood-sdk/commit/e420822c62ac6d07c20f01078e2620899415e3a7)

- **Summary**: `📝 Revised content for the Authentication section`
- **Impact**: None. This is a documentation update for the tutorial.
- **Analysis**: No user-facing impact.
- **Behaviors to Test**:
  - None.

### [9c282173768d06f541aa7265d0b8a6bcef2d430a](https://github.com/redwoodjs/redwood-sdk/commit/9c282173768d06f541aa7265d0b8a6bcef2d430a)

- **Summary**: `shadcn docs: path update, note combination, steps rearrange`
- **Impact**: None. This is a documentation update for the shadcn/ui guide.
- **Analysis**: No user-facing impact.
- **Behaviors to Test**:
  - None.

### [3ad893ab06d1413eb0994216af53765ce640ade5](https://github.com/redwoodjs/redwood-sdk/commit/3ad893ab06d1413eb0994216af53765ce640ade5)

- **Summary**: `📝 Fixed Expressive Code block and tweaked text for components.json configuration`
- **Impact**: None. This is a documentation update for the shadcn/ui guide.
- **Analysis**: No user-facing impact.
- **Behaviors to Test**:
  - None.

### [65c65d61713dea49ecfdca03b21fd5c571972cf8](https://github.com/redwoodjs/redwood-sdk/commit/65c65d61713dea49ecfdca03b21fd5c571972cf8)

- **Summary**: `Set redirect to manual.`
- **Impact**: This change affects how RSC action responses with redirects are handled on the client.
- **Analysis**: By setting `redirect: "manual"`, the client-side fetch transport now prevents the browser from automatically following redirect responses from server actions. This gives the framework more control over navigation after an action, but could be a regression if client-side code was relying on the automatic redirect. A user could have a server action that redirects, and now the redirect would be handled by the RSC protocol, not by the browser. This could break integrations that inspect the final redirected response.
- **Behaviors to Test**:
  - Server actions that return a `Response.redirect()` are correctly handled by the client router.
  - The browser's URL is updated correctly after a server action redirect.

### [83a981b9e6a6aabcb54b646f0f5b33ee6cc535ee](https://github.com/redwoodjs/redwood-sdk/commit/83a981b9e6a6aabcb54b646f0f5b33ee6cc535ee)

- **Summary**: `fix: Handle trailing commas in client component exports`
- **Impact**: This fixes a build failure for client components that use trailing commas in their export statements.
- **Analysis**: This was a bug in the Vite plugin that transforms `"use client"` modules. It didn't correctly handle trailing commas in `export` lists, which are valid JS syntax. The fix is to filter out empty export specifiers. This is a bug fix that improves the developer experience and makes the compiler more robust.
- **Behaviors to Test**:
  - A client component with a trailing comma in its named exports list builds and renders correctly.
  - A client component with a large number of named exports, with a trailing comma, builds and renders correctly.

### [7444b08fc78c28a46c6423a7a0dc4f5412ed413c](https://github.com/redwoodjs/redwood-sdk/commit/7444b08fc78c28a46c6423a7a0dc4f5412ed413c)

- **Summary**: `chore(release): 0.3.7`
- **Impact**: None. This is a release commit.
- **Analysis**: This commit marks the release of version 0.3.7. The functional changes for this release are included in the preceding commits.
- **Behaviors to Test**:
  - None.

### [a95eedb13975648447b6c23d67e494741905ea08](https://github.com/redwoodjs/redwood-sdk/commit/a95eedb13975648447b6c23d67e494741905ea08)

- **Summary**: `Fix client side navigation docs.`
- **Impact**: None. This is a documentation update for the client-side navigation guide.
- **Analysis**: No user-facing impact.
- **Behaviors to Test**:
  - None.

### [c041c6c320186bb4543ed245bd23bfd969a85e29](https://github.com/redwoodjs/redwood-sdk/commit/c041c6c320186bb4543ed245bd23bfd969a85e29)

- **Summary**: `tests: Smoke test matrix`
- **Impact**: None. This is a CI/CD change.
- **Analysis**: This commit introduces a test matrix for smoke tests, running them across different operating systems and package managers. This is an internal improvement to the testing infrastructure and has no direct impact on the user-facing behavior of the SDK.
- **Behaviors to Test**:
  - None.

### [db810a43af5ba6ea8c5aa83e86c80a42297bfeb1](https://github.com/redwoodjs/redwood-sdk/commit/db810a43af5ba6ea8c5aa83e86c80a42297bfeb1)

- **Summary**: `📝 Updated the Job List page within the Tutorial`
- **Impact**: None. This is a documentation update for the tutorial.
- **Analysis**: No user-facing impact.
- **Behaviors to Test**:
  - None.

### [34d65bfa5736cabf746048b5e60a799dda79c6a4](https://github.comcom/redwoodjs/redwood-sdk/commit/34d65bfa5736cabf746048b5e60a799dda79c6a4)

- **Summary**: `fix: Prevent module state loss from dev server re-optimization`
- **Impact**: This is a significant improvement to the developer experience, preventing crashes caused by module state loss during Vite's re-optimization process.
- **Analysis**: This commit introduces a unified, proactive scan of the entire dependency graph at startup. This gives Vite's optimizer a complete picture of the dependency graph up front, so that it can do its job more effectively. The use of barrel files and a custom `esbuild` plugin is a clever way to achieve this. This is a complex change that touches a lot of different parts of the build process.
- **Behaviors to Test**:
  - The dev server starts up without errors.
  - The application renders correctly in the browser.
  - There are no request waterfalls in the browser's network tab.
  - Changes to application code trigger HMR correctly.
  - Adding a new dependency to the application does not cause the dev server to crash.
  - Test with a project that uses TypeScript path aliases to ensure that they are resolved correctly.
  - Test with a project that has a complex dependency graph, including both third-party and application-level dependencies.
  - Test with different package managers (`pnpm`, `npm`, `yarn`) to ensure that the solution is package manager-agnostic.

### [328169669c9c5b28dd33fd9a96714426ae5f6f36](https://github.com/redwoodjs/redwood-sdk/commit/328169669c9c5b28dd33fd9a96714426ae5f6f36)

- **Summary**: `chore(release): 0.3.8`
- **Impact**: None. This is a release commit.
- **Analysis**: This commit marks the release of version 0.3.8. The functional changes for this release are included in the preceding commits.
- **Behaviors to Test**:
  - None.
