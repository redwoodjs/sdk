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

Notes
- Avoid mocks in tests; prefer direct behavior with DOM checks.
- Do not change the overall Document structure or script loading.

