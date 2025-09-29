import debug from "debug";
import MagicString from "magic-string";
import path from "path";
import { Plugin, ViteDevServer } from "vite";
import {
  VENDOR_CLIENT_BARREL_EXPORT_PATH,
  VENDOR_SERVER_BARREL_EXPORT_PATH,
} from "../lib/constants.mjs";

export function generateLookupMap({
  files,
  isDev,
  kind,
  exportName,
}: {
  files: Set<string>;
  isDev: boolean;
  kind: "client" | "server";
  exportName: string;
}) {
  const s = new MagicString(`
export const ${exportName} = {
  ${Array.from(files)
    .map((file: string) => {
      if (file.includes("node_modules") && isDev) {
        const barrelPath =
          kind === "client"
            ? VENDOR_CLIENT_BARREL_EXPORT_PATH
            : VENDOR_SERVER_BARREL_EXPORT_PATH;

        return `
  "${file}": () => import("${barrelPath}").then(m => m.default["${file}"]),
`;
      } else {
        return `
  "${file}": () => import("${file}"),
`;
      }
    })
    .join("")}
};
`);

  return {
    code: s.toString(),
    map: s.generateMap(),
  };
}

interface DirectiveLookupConfig {
  kind: "client" | "server";
  directive: "use client" | "use server";
  virtualModuleName: string;
  exportName: string;
  pluginName: string;
  optimizeForEnvironments?: string[];
}

export const createDirectiveLookupPlugin = async ({
  projectRootDir,
  files,
  config,
}: {
  projectRootDir: string;
  files: Set<string>;
  config: DirectiveLookupConfig;
}): Promise<Plugin> => {
  const debugNamespace = `rwsdk:vite:${config.pluginName}`;
  const log = debug(debugNamespace);
  let isDev = false;
  let devServer: ViteDevServer;

  log(
    "Initializing %s plugin with projectRootDir=%s",
    config.pluginName,
    projectRootDir,
  );

  return {
    name: `rwsdk:${config.pluginName}`,
    config(_, { command, isPreview }) {
      isDev = !isPreview && command === "serve";
      log("Development mode: %s", isDev);
    },
    configureServer(server) {
      devServer = server;
    },
    configEnvironment(env, viteConfig) {
      if (
        !isDev &&
        process.env.RWSDK_BUILD_PASS &&
        process.env.RWSDK_BUILD_PASS !== "worker"
      ) {
        return;
      }
      log("Configuring environment: env=%s", env);

      viteConfig.optimizeDeps ??= {};
      viteConfig.optimizeDeps.esbuildOptions ??= {};
      viteConfig.optimizeDeps.esbuildOptions.plugins ??= [];
      viteConfig.optimizeDeps.esbuildOptions.plugins.push({
        name: `rwsdk:${config.pluginName}`,
        setup(build) {
          log("Setting up esbuild plugin for %s", config.virtualModuleName);

          // Handle both direct virtual module name and /@id/ prefixed version
          const escapedVirtualModuleName = config.virtualModuleName.replace(
            /[-\/\\^$*+?.()|[\]{}]/g,
            "\\$&",
          );
          const escapedPrefixedModuleName =
            `/@id/${config.virtualModuleName}`.replace(
              /[-\/\\^$*+?.()|[\]{}]/g,
              "\\$&",
            );

          build.onResolve(
            {
              filter: new RegExp(
                `^(${escapedVirtualModuleName}|${escapedPrefixedModuleName})\\.js$`,
              ),
            },
            () => {
              process.env.VERBOSE &&
                log(
                  "Esbuild onResolve: marking %s as external",
                  config.virtualModuleName,
                );
              return {
                path: `${config.virtualModuleName}.js`,
                external: true,
              };
            },
          );
        },
      });

      const shouldOptimizeForEnv =
        !config.optimizeForEnvironments ||
        config.optimizeForEnvironments.includes(env);

      if (shouldOptimizeForEnv) {
        log("Applying optimizeDeps and aliasing for environment: %s", env);

        viteConfig.optimizeDeps.include ??= [];

        for (const file of files) {
          if (file.includes("node_modules")) {
            continue;
          }

          const actualFilePath = path.join(projectRootDir, file);

          process.env.VERBOSE &&
            log("Adding to optimizeDeps.entries: %s", actualFilePath);
          const entries = Array.isArray(viteConfig.optimizeDeps.entries)
            ? viteConfig.optimizeDeps.entries
            : ([] as string[]).concat(viteConfig.optimizeDeps.entries ?? []);
          viteConfig.optimizeDeps.entries = entries;
          entries.push(actualFilePath);
        }

        log("Environment configuration complete for env=%s", env);
      } else {
        log("Skipping optimizeDeps and aliasing for environment: %s", env);
      }
    },
    resolveId(source) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      if (source !== `${config.virtualModuleName}.js`) {
        return null;
      }

      // context(justinvdm, 3 Sep 2025): This logic determines *when* to
      // generate and bundle the lookup map. By conditionally externalizing it,
      // we ensure the map is only created after tree-shaking is complete and
      // that it's correctly shared between the SSR and final worker builds.
      log("Resolving %s module", config.virtualModuleName);
      const envName = this.environment?.name;

      // 1. Worker Pass -> externalize
      if (
        isDev &&
        envName === "worker" &&
        process.env.RWSDK_BUILD_PASS === "worker"
      ) {
        // context(justinvdm, 3 Sep 2025): We externalize the lookup during the
        // first worker pass. This defers its bundling until after the
        // directivesFilteringPlugin has had a chance to run and tree-shake
        // the list of client/server files.
        log("Marking as external for worker pass");
        return { id: source, external: true };
      }

      // 2. SSR Pass -> externalize
      if (isDev && envName === "ssr") {
        // context(justinvdm, 3 Sep 2025): We also externalize during the SSR
        // build. This ensures that both the worker and SSR artifacts refer to
        // the same virtual module, which will be resolved into a single, shared
        // lookup map during the final linker pass.
        log("Marking as external for ssr pass");
        return { id: source, external: true };
      }

      // 3. Client Pass & 4. Linker Pass -> resolve and bundle
      // context(justinvdm, 3 Sep 2025): For the client build, the dev server,
      // and the final linker pass, we resolve the module ID with a null-byte
      // prefix. This signals to Vite/Rollup that this is a virtual module
      // whose content should be provided by the `load` hook, bundling it in.
      log("Resolving for bundling");

      return source;
    },
    async load(id) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }

      if (id === config.virtualModuleName + ".js") {
        log(
          "Loading %s module with %d files",
          config.virtualModuleName,
          files.size,
        );

        const environment = this.environment?.name || "client";
        log("Current environment: %s, isDev: %s", environment, isDev);

        return generateLookupMap({
          files,
          isDev,
          kind: config.kind,
          exportName: config.exportName,
        });
      }
    },
  };
};
