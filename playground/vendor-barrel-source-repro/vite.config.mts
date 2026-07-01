import { cloudflare } from "@cloudflare/vite-plugin";
import { redwood } from "rwsdk/vite";
import { defineConfig, Plugin } from "vite";

/**
 * This plugin demonstrates the issue: files from my-ui-lib that live in
 * node_modules should be transformed by the host's Vite pipeline, but in dev
 * RedwoodSDK routes them through the pre-bundled vendor barrel, so this
 * transform never runs.
 */
const myUiLibTransformMarker = (): Plugin => ({
  name: "my-ui-lib-transform-marker",
  transform(code, id) {
    // Match both real node_modules paths and the resolved symlink source path.
    // Skip virtual SSR bridge modules to avoid double-transforming.
    if (
      id.includes("/my-ui-lib/") &&
      id.endsWith(".tsx") &&
      !id.includes("virtual:rwsdk:ssr:")
    ) {
      console.log(`[host-transform] Running host transform for ${id}`);
      return {
        code:
          `import "./button.css";\n` +
          `globalThis.__myUiLibHostTransformRan = true;\n` +
          code,
        map: null,
      };
    }
  },
});

export default defineConfig({
  optimizeDeps: {
    // Tell Vite not to pre-bundle this raw-source package. RedwoodSDK should
    // honor this by treating the package's directive files like app files and
    // including them in the app barrel instead of the pre-bundled vendor barrel.
    exclude: ["my-ui-lib"],
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
    myUiLibTransformMarker(),
  ],
});
