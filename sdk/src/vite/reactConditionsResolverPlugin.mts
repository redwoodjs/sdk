import { resolve } from "path";
import path from "path";
import { Plugin, EnvironmentOptions } from "vite";
import { createRequire } from "node:module";
import debug from "debug";
import { pathExists } from "fs-extra";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";

const log = debug("rwsdk:vite:react-conditions");

// Define package sets for each environment
const WORKER_PACKAGES = [
  "react",
  "react-dom/server.edge",
  "react-dom/server",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-server-dom-webpack/client.browser",
  "react-server-dom-webpack/client.edge",
  "react-server-dom-webpack/server.edge",
];

const CLIENT_PACKAGES = [
  "react",
  "react-dom/client",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-server-dom-webpack/client.browser",
  "react-server-dom-webpack/client.edge",
  "react-server-dom-webpack/server.edge",
];

// Skip react-server condition for these packages
const SKIP_REACT_SERVER = [
  "react-dom/server",
  "react-dom/client",
  "react-dom/server.edge",
  "react-dom/server.browser",
];

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

    // Environment conditions
    const env = environment || "worker";
    const conditions: string[] = [];

    if (env === "worker") {
      conditions.push("workerd", "edge", "worker");
    } else {
      conditions.push("browser");
    }

    // React-server condition - apply selectively
    if (!SKIP_REACT_SERVER.includes(packageName)) {
      conditions.push("react-server");
    }

    try {
      const baseResolved = sdkRequire.resolve(packageName);
      const packageDir = path.dirname(baseResolved);
      const baseName = path.basename(baseResolved, ".js");

      // Helper to check path existence and log if found
      const tryPath = async (filepath: string, type: string) => {
        if (await pathExists(filepath)) {
          log("Using %s for %s: %s", type, packageName, filepath);
          return filepath;
        }
        return null;
      };

      // Try condition-specific paths first
      for (const condition of conditions) {
        const conditionPath = path.join(
          packageDir,
          `${baseName}.${condition}.js`
        );
        const found = await tryPath(conditionPath, `condition ${condition}`);
        if (found) return found;
      }

      // Try mode-specific paths based on package type
      if (packageName.includes("react-server-dom-webpack")) {
        const [pkgBase, type, env] = packageName.split("/");
        const filename =
          type === "server"
            ? `${pkgBase}-${type}.${env}.${mode}.js`
            : `${pkgBase}-${type}.${mode}.js`;

        const cjsPath = path.join(packageDir, "cjs", filename);
        const found = await tryPath(cjsPath, `webpack ${mode} mode`);
        if (found) {
          return found;
        } else {
          log("Using standard resolution for %s", packageName);
          return baseResolved;
        }
      } else {
        const modePath = baseResolved.replace(
          /\.js$/,
          mode === "development" ? ".development.js" : ".production.min.js"
        );
        const found = await tryPath(modePath, `${mode} mode`);
        if (found) {
          return found;
        }
      }

      // Fall back to standard resolution
      log("Using standard resolution for %s", packageName);
      return baseResolved;
    } catch (error) {
      log("Error in custom resolution for %s: %o", packageName, error);
      return sdkRequire.resolve(packageName);
    }
  };

  // Generate import mappings for environments
  const generateImports = async (packages: string[], env: string) => {
    const imports: Record<string, string> = {};
    for (const pkg of packages) {
      imports[pkg] = await resolveWithMode(pkg, env);
    }
    return imports;
  };

  // Generate import mappings for both environments
  const workerImports = await generateImports(WORKER_PACKAGES, "worker");
  const clientImports = await generateImports(CLIENT_PACKAGES, "client");
  // Log the resolved paths
  const logImports = (env: string, imports: Record<string, string>) => {
    log(`Resolved ${env} paths (${mode} mode):`);
    Object.entries(imports).forEach(([id, path]) => {
      log("- %s: %s", id, path);
    });
  };

  logImports("worker", workerImports);
  logImports("client", clientImports);

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

  // Helper to configure an environment
  const configureEnvironment = (
    name: string,
    config: EnvironmentOptions,
    imports: Record<string, string>
  ) => {
    log(
      `Applying React conditions resolver for ${name} environment in ${mode} mode`
    );

    // Mutate optimizeDeps.esbuildOptions
    (config.optimizeDeps ??= {}).esbuildOptions ??= {};
    config.optimizeDeps.esbuildOptions.plugins = [
      ...(config.optimizeDeps.esbuildOptions.plugins || []),
      createEsbuildPlugin(name, imports),
    ];

    // Initialize resolve config if needed
    config.resolve ??= {};

    // Initialize alias if it doesn't exist
    (config.resolve as any).alias ??= [];

    // If alias is an object, convert it to array while preserving entries
    if (!Array.isArray((config.resolve as any).alias)) {
      const existingAlias = (config.resolve as any).alias;
      (config.resolve as any).alias = Object.entries(existingAlias).map(
        ([find, replacement]) => ({ find, replacement })
      );
    }

    // Add each package import as a separate alias entry
    Object.entries(imports).forEach(([id, resolvedPath]) => {
      const exactMatchRegex = new RegExp(
        `^${id.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`
      );

      (config.resolve as any).alias.push({
        find: exactMatchRegex,
        replacement: resolvedPath,
      });

      log(`${name}: Added alias for ${id} -> ${resolvedPath}`);
    });
  };

  return {
    name: `rwsdk:react-conditions-resolver:${mode}`,
    enforce: "post",

    async resolveId(source: string) {
      // Use worker or client imports based on environment
      const imports =
        this.environment?.name === "worker" ? workerImports : clientImports;

      if (imports[source]) {
        log(
          `resolveId (${this.environment?.name}): Resolving ${source} -> ${imports[source]}`
        );
        return imports[source];
      }
      return null;
    },

    configEnvironment(name: string, config: EnvironmentOptions) {
      if (name === "worker") {
        configureEnvironment("worker", config, workerImports);
      }

      if (name === "client") {
        configureEnvironment("client", config, clientImports);
      }
    },
  };
};
