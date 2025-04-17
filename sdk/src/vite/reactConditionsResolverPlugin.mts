import { resolve } from "path";
import path from "path";
import { Plugin } from "vite";
import { createRequire } from "node:module";
import debug from "debug";
import { pathExists } from "fs-extra";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";

const log = debug("rwsdk:vite:react-conditions");

export const reactConditionsResolverPlugin = async ({
  projectRootDir,
  mode = "development",
}: {
  projectRootDir: string;
  mode?: "development" | "production";
}): Promise<Plugin> => {
  log("Initializing React conditions resolver plugin in %s mode", mode);

  // Create a require function to resolve node modules from the SDK
  const sdkRequire = createRequire(
    resolve(projectRootDir, "node_modules/@redwoodjs/sdk")
  );

  // Path to custom React builds in the vendor directory
  const vendorDir = VENDOR_DIST_DIR;

  // Helper to resolve packages with mode in mind
  const resolveWithMode = async (packageName: string, environment: string) => {
    // For custom React builds, use our own bundled versions
    if (packageName === "react") {
      const modePath = resolve(vendorDir, `react.${mode}.js`);
      if (await pathExists(modePath)) {
        log("Using custom %s mode build for %s", mode, packageName);
        return modePath;
      }
    }

    // Special case handling for specific imports
    const env = environment || "worker"; // Default to worker

    // Determine which conditions to apply based on package and environment
    let conditions: string[] = [];

    // Environment conditions
    if (env === "worker") {
      conditions.push("workerd", "edge", "worker");
    } else {
      conditions.push("browser");
    }

    // React-server condition - apply selectively
    const skipReactServer = [
      "react-dom/server",
      "react-dom/client",
      "react-dom/server.edge",
      "react-dom/server.browser",
    ];

    if (!skipReactServer.includes(packageName)) {
      conditions.push("react-server");
    }

    try {
      // Try to do a custom resolution with our specific conditions
      // Note: Node's require.resolve doesn't directly support conditions, so
      // we would need a more sophisticated package resolution algorithm
      // This is a simplified approach

      // Start with standard resolution
      const baseResolved = sdkRequire.resolve(packageName);

      // Now look for condition-specific variants
      const packageDir = path.dirname(baseResolved);
      const baseName = path.basename(baseResolved, ".js");

      // Try possible condition-specific file patterns
      for (const condition of conditions) {
        const conditionPath = path.join(
          packageDir,
          `${baseName}.${condition}.js`
        );
        if (await pathExists(conditionPath)) {
          log(
            "Using condition %s for %s: %s",
            condition,
            packageName,
            conditionPath
          );
          return conditionPath;
        }
      }

      // Handle development/production variants
      const isDev = mode === "development";
      const modePath = baseResolved.replace(
        /\.js$/,
        isDev ? ".development.js" : ".production.min.js"
      );

      if (await pathExists(modePath)) {
        log("Using %s mode build for %s", mode, packageName);
        return modePath;
      }

      // Fall back to standard resolution
      return baseResolved;
    } catch (error) {
      log("Error in custom resolution for %s: %o", packageName, error);
      // Fall back to standard resolution
      return sdkRequire.resolve(packageName);
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
    workerImports[pkg] = await resolveWithMode(pkg, "worker");
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
    clientImports[pkg] = await resolveWithMode(pkg, "client");
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
      name: `rwsdk:${env}:react-conditions:${mode}`,
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
    name: `rwsdk:react-conditions-resolver:${mode}`,
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
