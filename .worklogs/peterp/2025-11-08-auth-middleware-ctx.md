## 2025-11-08 auth middleware ctx docs update

1. Read `docs/src/content/docs/core/authentication.mdx` to confirm existing coverage focuses on passkeys and session APIs without mentioning middleware or `ctx`.
2. Inspected `sdk/src/runtime/requestInfo/types.ts` and `sdk/src/runtime/lib/router.ts` to confirm `ctx` is stored on the request info and that middleware runs before route handlers and can short-circuit with a response.
3. Checked `sdk/src/runtime/worker.tsx` to verify thrown `Response` or `ErrorResponse` objects propagate to the worker layer and become HTTP responses, which explains what happens when middleware throws.

Current plan: extend the auth docs with a section that shows how to load session data inside middleware, set properties on `ctx`, and describe the runtime behavior when middleware throws a `Response` or `ErrorResponse`.
4. Incorporated the user's request to emphasize RedwoodSDK's request/response model by planning additional documentation around headers, cookies, `ctx`, and per-route interruptors.
5. Added a Request/Response Foundations section near the top of the authentication doc to highlight headers, cookies, `ctx`, and interruptors before readers reach the detailed API sections.
