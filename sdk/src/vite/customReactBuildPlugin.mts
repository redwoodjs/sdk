import { resolve } from "path";
import { Plugin } from "vite";
import { createRequire } from "node:module";
import debug from "debug";

const log = debug("rwsdk:vite:react-build");

export const customReactBuildPlugin = async ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Promise<Plugin> => {
  log("Initializing custom React build plugin");

  // Create a require function to resolve node modules from the SDK
  const sdkRequire = createRequire(
    resolve(projectRootDir, "node_modules/@redwoodjs/sdk")
  );

  // Define mappings for worker environment
  const workerImports = {
    react: sdkRequire.resolve("react"),
    "react-dom/server.edge": sdkRequire.resolve("react-dom/server.edge"),
    "react-dom/server": sdkRequire.resolve("react-dom/server"),
    "react-dom": sdkRequire.resolve("react-dom"),
    "react/jsx-runtime": sdkRequire.resolve("react/jsx-runtime"),
    "react/jsx-dev-runtime": sdkRequire.resolve("react/jsx-dev-runtime"),
    "react-server-dom-webpack/client.browser": sdkRequire.resolve(
      "react-server-dom-webpack/client.browser"
    ),
    "react-server-dom-webpack/client.edge": sdkRequire.resolve(
      "react-server-dom-webpack/client.edge"
    ),
    "react-server-dom-webpack/server.edge": sdkRequire.resolve(
      "react-server-dom-webpack/server.edge"
    ),
  };

  // Define mappings for client environment
  const clientImports = {
    react: sdkRequire.resolve("react"),
    "react-dom/client": sdkRequire.resolve("react-dom/client"),
    "react-dom": sdkRequire.resolve("react-dom"),
    "react/jsx-runtime": sdkRequire.resolve("react/jsx-runtime"),
    "react/jsx-dev-runtime": sdkRequire.resolve("react/jsx-dev-runtime"),
    "react-server-dom-webpack/client.browser": sdkRequire.resolve(
      "react-server-dom-webpack/client.browser"
    ),
  };

  // Log the resolved paths
  log("Resolved worker paths:");
  Object.entries(workerImports).forEach(([id, path]) => {
    log("- %s: %s", id, path);
  });

  log("Resolved client paths:");
  Object.entries(clientImports).forEach(([id, path]) => {
    log("- %s: %s", id, path);
  });

  // Helper function to create esbuild plugins from import mappings
  const createEsbuildPlugin = (
    env: string,
    imports: Record<string, string>
  ) => {
    return {
      name: `rwsdk:${env}:rewrite-react-imports`,
      setup(build: any) {
        Object.entries(imports).forEach(([id, path]) => {
          build.onResolve(
            { filter: new RegExp(`^${id.replace(/\//g, "\\/")}$`) },
            (args: any) => {
              log(`esbuild ${env} resolving ${id} -> %s`, path);
              return { path };
            }
          );
        });
      },
    };
  };

  return {
    name: "rwsdk:custom-react-build",
    enforce: "pre",

    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [createEsbuildPlugin("worker", workerImports)],
            },
          },
          resolve: {
            alias: workerImports,
            // context(justinvdm, 17-04-2025): Per-environment aliases appear supported but not yet typed
            // https://github.com/vitejs/vite/blob/fdb36e076969c763d4249f6db890f8bf26e9f5d1/packages/vite/src/node/idResolver.ts#L62
          } as {},
        },
        client: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [createEsbuildPlugin("client", clientImports)],
            },
          },
          resolve: {
            alias: clientImports,
          } as {},
        },
      },
    }),
  };
};
