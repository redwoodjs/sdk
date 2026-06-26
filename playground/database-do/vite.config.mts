import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
  environments: {
    worker: {
      build: {
        rolldownOptions: {
          experimental: {
            // context(justinvdm, 2026-06-26): Vite 8's Rolldown has a bug
            // where lazy barrel wrappers for `sideEffects: false` modules can
            // leave named imports unbound at runtime (e.g. kysely's `freeze`
            // helper). Disabling lazy barrels works around this until the
            // upstream Rolldown issue is fixed.
            lazyBarrel: false,
          },
        },
      },
    },
  },
});
