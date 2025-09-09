## Discussion

- **decision** Third-party library compatibility issues, especially with component libraries like ShadCN and Base UI, are a high priority. The focus is on ensuring common libraries work smoothly.
- **observation** Server-side rendering (SSR) is a significant source of instability. Errors during SSR can hang the dev server, which breaks HMR and forces a restart.
- **observation** Error messages are often cryptic, particularly for SSR-related failures where output is sometimes swallowed entirely. There is a need for clearer, more actionable error messages with links to documentation.
- **decision** There is currently no formal CVE monitoring process. A lightweight process to address critical vulnerabilities will be established for the 1.0 release, but it is not a 1.0-beta blocker.
- **decision** By 1.0-beta, documentation must be updated to clearly label features as either "stable" or "experimental".
- **decision** The guiding principle for the 1.0 release is to prioritize pragmatic and lightweight fixes to address core stability issues effectively within the timeline.
- **decision** The labels `1.0-beta`, `1.0`, `future`, and `experimental` will function as both tags and milestones to dictate the priority and timing of work.
- **decision** Windows-specific bugs, such as the path issue in the directive scanner, will be deprioritized to the `1.0` milestone. The difficulty and time required for reproduction on Windows make it a lower priority than other stability issues for the beta.
- **decision** Major dependencies (React, Vite, `@cloudflare/vite-plugin`) will be moved from the SDK's bundled dependencies to `peerDependencies`. The starter templates will be updated to include these as direct dependencies. This is a breaking change planned for the 1.0-beta cycle to improve project independence and transparency.
- **decision** The dependency management changes will be broken into three vertically-sliced tasks: one for React, one for Vite, and one for the Cloudflare Vite plugin.
- **observation** A bug exists with the layout context functionality where context provided from a layout component is not available on the client-side during development. This appears to be caused by the module being evaluated twice.
- **decision** Vitest integration is not currently supported. Investigating and adding support is considered a `future` task, not for the 1.0 release.
- **decision** The style smoke tests are flaky and have been skipped. Fixing them is slated for the `1.0` milestone.
