import { defineConfig, Plugin } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * This plugin demonstrates the issue: files from my-ui-lib that live in
 * node_modules should be transformed by the host's Vite pipeline, but in dev
 * RedwoodSDK routes them through the pre-bundled vendor barrel, so this
 * transform never runs.
 */
const myUiLibTransformMarker = (): Plugin => ({
  name: "my-ui-lib-transform-marker",
  transform(code, id) {
    if (id.includes("node_modules/my-ui-lib")) {
      console.log(`[host-transform] Running host transform for ${id}`);
      return {
        code:
          `import "./button.css";\n` +
          code +
          `\nconsole.log("[host-transform] CLIENT-SIDE MARKER for", ${JSON.stringify(id)});\n`,
        map: null,
      };
    }
  },
});

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
    myUiLibTransformMarker(),
  ],
});
