import type { Plugin } from "vite";

// context(justinvdm, 2026-06-26):
// Vite 8 uses Rolldown for production builds. Rolldown's lazy ESM wrapper
// optimization (the `__esmMin`-style wrappers it emits for modules whose
// `sideEffects` are false) has a bug where named imports used inside the
// wrapper body are not rebound to the minified/rename top-level binding.
//
// For packages with `sideEffects: false` this can surface as runtime errors
// such as `ReferenceError: <named import> is not defined`: the import is
// renamed to a short identifier everywhere else, but the lazy wrapper still
// calls it by its original name.
//
// A targeted workaround is to tell Rolldown that all `node_modules` ESM
// modules have side effects in the worker environment, so it includes them
// eagerly instead of wrapping them lazily. This keeps the renamed bindings in
// scope. The bundle-size impact is limited because the worker build already
// bundles all dependencies (`noExternal: true`).
//
// This plugin should be revisited and removed once the upstream Rolldown bug
// is fixed.

export const rolldownCompatPlugin = (): Plugin => ({
  name: "rwsdk:rolldown-compat",

  transform(code, id) {
    const envName = this.environment?.name;

    if (envName !== "worker") {
      return;
    }

    if (
      id.includes("/node_modules/") &&
      (id.endsWith(".js") || id.endsWith(".mjs"))
    ) {
      return {
        code,
        map: null,
        moduleSideEffects: true,
      };
    }
  },
});
