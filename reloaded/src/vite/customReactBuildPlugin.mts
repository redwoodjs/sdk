import { resolve } from "path";
import { Plugin } from "vite";

import { VENDOR_DIST_DIR } from "../lib/constants.mjs";

export const customReactBuildPlugin = (): Plugin => {
  return {
    name: "custom-react-build-plugin",
    enforce: "pre",

    resolveId(id) {
      if (this.environment.name !== "worker") {
        return;
      }

      if (id === "react") {
        return resolve(VENDOR_DIST_DIR, "react.js");
      }

      if (id === "react-dom/server.edge" || id === "react-dom/server") {
        return resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js");
      }
    },

    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: "rewrite-react-imports",
                  setup(build) {
                    build.onResolve({ filter: /^react$/ }, (args) => {
                      return { path: resolve(VENDOR_DIST_DIR, "react.js") };
                    });

                    build.onResolve({ filter: /^react-dom\/server\.edge$/ }, (args) => {
                      return { path: resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js") };
                    });
                  },
                },
              ],
            }
          }
        }
      },
    }),
  };
};
