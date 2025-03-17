import { resolve } from "path";
import { mkdirp, copy } from "fs-extra";
import { Plugin } from "vite";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";

const copyReactFiles = async (viteDistDir: string) => {
  await mkdirp(viteDistDir);
  await copy(
    resolve(VENDOR_DIST_DIR, "react.js"),
    resolve(viteDistDir, "react.js"),
  );
  await copy(
    resolve(VENDOR_DIST_DIR, "react.js.map"),
    resolve(viteDistDir, "react.js.map"),
  );
  await copy(
    resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js"),
    resolve(viteDistDir, "react-dom-server-edge.js"),
  );
  await copy(
    resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js.map"),
    resolve(viteDistDir, "react-dom-server-edge.js.map"),
  );
};

export const customReactBuildPlugin = async ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Promise<Plugin> => {
  const viteDistDir = resolve(
    projectRootDir,
    "node_modules",
    ".vite_redwoodsdk",
  );
  await copyReactFiles(viteDistDir);
  return {
    name: "custom-react-build-plugin",
    enforce: "pre",
    applyToEnvironment: (environment) => {
      return environment.name === "worker";
    },
    async configureServer() {
      await mkdirp(viteDistDir);
      await copy(
        resolve(VENDOR_DIST_DIR, "react.js"),
        resolve(viteDistDir, "react.js"),
      );
      await copy(
        resolve(VENDOR_DIST_DIR, "react.js.map"),
        resolve(viteDistDir, "react.js.map"),
      );
      await copy(
        resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js"),
        resolve(viteDistDir, "react-dom-server-edge.js"),
      );
      await copy(
        resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js.map"),
        resolve(viteDistDir, "react-dom-server-edge.js.map"),
      );
    },
    resolveId(id) {
      if (id === "react") {
        return resolve(viteDistDir, "react.js");
      }
      if (id === "react-dom/server.edge" || id === "react-dom/server") {
        return resolve(viteDistDir, "react-dom-server-edge.js");
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
                      return { path: resolve(viteDistDir, "react.js") };
                    });
                    build.onResolve(
                      { filter: /^react-dom\/server\.edge$/ },
                      (args) => {
                        return {
                          path: resolve(
                            viteDistDir,
                            "react-dom-server-edge.js",
                          ),
                        };
                      },
                    );
                  },
                },
              ],
            },
          },
        },
      },
    }),
  };
};
