// context(justinvdm, 2025-04-17): Since we want to pin react versions in sdk
// rather than have this maintained on user's side, we pre-build jsx runtimes so
// that optimize deps can do its cjs to esm conversion at this point already.
// This lets us point to these prebuilt versions rather than trying to get vite
// and @cloudflare/vite-plugin to understand that we want to use the sdk's jsx
// runtime deps when optimizing deps for the user, as the latter has proven in
// the past to be difficult to accomplish:
// https://github.com/redwoodjs/sdk/pull/144
export * from "react/jsx-runtime";
