Title: Xterm playground example

Problem
- Add a playground example that demonstrates a client component using @xterm/xterm.

Context
- Playground examples live under `playground/` and follow the structure of `playground/hello-world`.
- Each example includes an end-to-end test under `__tests__/` executed from the monorepo root.
- Keep `Document.tsx` structure intact and load the client entry via a manual script tag.

Plan
- Copy `playground/hello-world` to `playground/xterm`.
- Add a client component that initializes an xterm terminal instance.
- Render the terminal on the Home page.
- Include xterm CSS.
- Add e2e test to assert that the terminal renders.

### Attempt 1: Stubbing Navigator API

The core issue is that `@xterm/xterm` accesses `navigator.platform` and `navigator.userAgent` at module load time. These are undefined in the worker environment during SSR.

An attempt was made to polyfill these missing `navigator` properties by creating a `stubs.ts` file that injects a minimal `navigator` object into the global scope and importing it as the first line in `worker.tsx`. This did not work, likely because of bundling intricacies where `@xterm/xterm`'s platform detection code is evaluated before the stub can take effect.

### Attempt 2: Using Vite's `define` Option

The working solution is to use Vite's `define` option in the SSR environment configuration. This performs a direct text replacement at build time, replacing `navigator.platform` with the string `"CloudflareWorkers"` and `window` with `globalThis` before the code is evaluated.

In `@xterm/xterm`'s `Platform.ts`, the library checks `navigator.platform` at module load time (line 19 in the source). By using Vite's `define`, these references are replaced during the build process, preventing runtime errors in the Cloudflare Workers environment where these browser APIs don't exist.

This approach works because the replacements happen during bundling, not at runtime, so the transformed code never tries to access the missing `navigator` object.