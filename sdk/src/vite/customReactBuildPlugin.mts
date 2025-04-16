import { resolve } from "path";
import { mkdirp, copy } from "fs-extra";
import { Plugin } from "vite";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";

const copyReactFiles = async (viteDistDir: string) => {
  await mkdirp(viteDistDir);

  const vendorBundles = [
    "react",
    "react-dom-server-edge",
    "jsx-runtime",
    "jsx-dev-runtime",
  ] as const;

  for (const mode of ["development", "production"] as const) {
    for (const bundle of vendorBundles) {
      await copy(
        resolve(VENDOR_DIST_DIR, `${bundle}.${mode}.js`),
        resolve(viteDistDir, `${bundle}.${mode}.js`)
      );
      await copy(
        resolve(VENDOR_DIST_DIR, `${bundle}.${mode}.js.map`),
        resolve(viteDistDir, `${bundle}.${mode}.js.map`)
      );
    }
  }
};

const createJsxRuntimeEsbuildPlugin = (
  viteDistDir: string,
  mode: "development" | "production"
) => ({
  name: "rwsdk:rewrite-jsx-runtime-imports",
  setup(build: any) {
    build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
      path: resolve(viteDistDir, `jsx-runtime.${mode}.js`),
    }));
    build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
      path: resolve(viteDistDir, `jsx-dev-runtime.${mode}.js`),
    }));
  },
});

export const customReactBuildPlugin = async ({
  projectRootDir,
  mode,
}: {
  projectRootDir: string;
  mode: "development" | "production";
}): Promise<Plugin[]> => {
  const viteDistDir = resolve(
    projectRootDir,
    "node_modules",
    ".vite_redwoodjs_sdk"
  );

  const resolveVendorBundle = (name: string) =>
    resolve(viteDistDir, `${name}.${mode}.js`);

  await copyReactFiles(viteDistDir);

  const commonPlugin: Plugin = {
    name: "rwsdk:jsx-runtime",
    enforce: "pre",
    resolveId(id) {
      if (id === "react/jsx-runtime") {
        return resolveVendorBundle("jsx-runtime");
      }
      if (id === "react/jsx-dev-runtime") {
        return resolveVendorBundle("jsx-dev-runtime");
      }
    },
    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  ...createJsxRuntimeEsbuildPlugin(viteDistDir, mode),
                  name: "rwsdk:worker:rewrite-jsx-runtime-imports",
                },
              ],
            },
          },
        },
        client: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  ...createJsxRuntimeEsbuildPlugin(viteDistDir, mode),
                  name: "rwsdk:client:rewrite-jsx-runtime-imports",
                },
              ],
            },
          },
        },
      },
    }),
  };

  const workerReactPlugin: Plugin = {
    name: "rwsdk:custom-react-build",
    enforce: "pre",
    applyToEnvironment: (environment) => {
      return environment.name === "worker";
    },
    async configureServer() {
      await copyReactFiles(viteDistDir);
    },
    resolveId(id) {
      if (id === "react") {
        return resolveVendorBundle("react");
      }
      if (id === "react-dom/server.edge" || id === "react-dom/server") {
        return resolveVendorBundle("react-dom-server-edge");
      }
    },
    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: "rwsdk:rewrite-react-imports",
                  setup(build) {
                    build.onResolve({ filter: /^react$/ }, () => ({
                      path: resolveVendorBundle("react"),
                    }));
                    build.onResolve(
                      { filter: /^react-dom\/server\.edge$/ },
                      () => ({
                        path: resolveVendorBundle("react-dom-server-edge"),
                      })
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

  return [commonPlugin, workerReactPlugin];
};
