import { resolve } from "path";
import { Plugin } from "vite";
import { createRequire } from "node:module";
import debug from "debug";
import { pathExists } from "fs-extra";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";

const log = debug("rwsdk:vite:react-build");

export const customReactBuildPlugin = async ({
  projectRootDir,
  mode = "development",
}: {
  projectRootDir: string;
  mode?: "development" | "production";
}): Promise<Plugin> => {
  log("Initializing custom React build plugin in %s mode", mode);

  // Create a require function to resolve node modules from the SDK
  const sdkRequire = createRequire(
    resolve(projectRootDir, "node_modules/@redwoodjs/sdk")
  );

  // Path to custom React builds in the vendor directory
  const vendorDir = VENDOR_DIST_DIR;

  // Helper to resolve packages with mode in mind
  const resolveWithMode = async (packageName: string) => {
    // For custom React builds, check for mode-specific files in the vendor directory
    if (packageName === "react") {
      const modePath = resolve(vendorDir, `react.${mode}.js`);
      if (await pathExists(modePath)) {
        log("Using custom %s mode build for %s", mode, packageName);
        return modePath;
      }
    }

    // For React server internals, check for mode-specific files
    if (packageName === "react-server-internals") {
      const modePath = resolve(vendorDir, `react-server-internals.${mode}.js`);
      if (await pathExists(modePath)) {
        log("Using custom %s mode build for %s", mode, packageName);
        return modePath;
      }
    }

    // For standard packages, apply mode-specific logic to the path
    // Standard resolution for other packages
    const resolvedPath = sdkRequire.resolve(packageName);

    // Check if we should use a development or production build
    const isDev = mode === "development";

    // Many React packages have mode-specific files like:
    // - react.development.js / react.production.min.js
    // Try to construct the appropriate path
    const modePath = resolvedPath.replace(
      /\.js$/,
      isDev ? ".development.js" : ".production.min.js"
    );

    try {
      // Check if the mode-specific file exists
      if (await pathExists(modePath)) {
        log("Using %s mode build for %s", mode, packageName);
        return modePath;
      } else {
        // Fall back to default resolution if mode-specific file doesn't exist
        log("Mode-specific file not found for %s, using default", packageName);
        return resolvedPath;
      }
    } catch (error) {
      // Fall back to default resolution if there's an error
      log(
        "Error resolving %s mode-specific file for %s: %o",
        mode,
        packageName,
        error
      );
      return resolvedPath;
    }
  };

  // Define mappings for worker environment
  const workerImports: Record<string, string> = {};

  // Populate worker imports asynchronously
  for (const pkg of [
    "react",
    "react-dom/server.edge",
    "react-dom/server",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-server-dom-webpack/client.browser",
    "react-server-dom-webpack/client.edge",
    "react-server-dom-webpack/server.edge",
  ]) {
    workerImports[pkg] = await resolveWithMode(pkg);
  }

  // Define mappings for client environment
  const clientImports: Record<string, string> = {};

  // Populate client imports asynchronously
  for (const pkg of [
    "react",
    "react-dom/client",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-server-dom-webpack/client.browser",
  ]) {
    clientImports[pkg] = await resolveWithMode(pkg);
  }

  // Log the resolved paths
  log("Resolved worker paths (%s mode):", mode);
  Object.entries(workerImports).forEach(([id, path]) => {
    log("- %s: %s", id, path);
  });

  log("Resolved client paths (%s mode):", mode);
  Object.entries(clientImports).forEach(([id, path]) => {
    log("- %s: %s", id, path);
  });

  // Helper function to create esbuild plugins from import mappings
  const createEsbuildPlugin = (
    env: string,
    imports: Record<string, string>
  ) => {
    return {
      name: `rwsdk:${env}:rewrite-react-imports:${mode}`,
      setup(build: any) {
        Object.entries(imports).forEach(([id, path]) => {
          build.onResolve(
            { filter: new RegExp(`^${id.replace(/\//g, "\\/")}$`) },
            (args: any) => {
              log(`esbuild ${env} resolving ${id} (${mode}) -> %s`, path);
              return { path };
            }
          );
        });
      },
    };
  };

  return {
    name: `rwsdk:custom-react-build:${mode}`,
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
