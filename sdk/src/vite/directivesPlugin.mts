import { Plugin } from "vite";
import path from "node:path";
import fs from "node:fs/promises";
import debug from "debug";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { transformServerFunctions } from "./transformServerFunctions.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import type { ViteDevServer } from "vite";

const log = debug("rwsdk:vite:rsc-directives-plugin");

const getLoader = (filePath: string) => {
  const ext = path.extname(filePath).slice(1);
  switch (ext) {
    case "mjs":
    case "cjs":
      return "js";
    case "mts":
    case "cts":
      return "ts";
    case "jsx":
      return "jsx";
    case "tsx":
      return "tsx";
    case "ts":
      return "ts";
    case "js":
    default:
      return "js";
  }
};

export const directivesPlugin = ({
  projectRootDir,
  clientFiles,
  serverFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
}): Plugin => {
  let devServer: ViteDevServer;
  let isAfterFirstResponse = false;

  const addModule = (
    kind: "client" | "server",
    environment: string,
    id: string,
  ) => {
    const files = kind === "client" ? clientFiles : serverFiles;
    const rawId = id.split("?")[0];
    const resolvedId = normalizeModulePath(rawId, projectRootDir);
    const fullPath = normalizeModulePath(rawId, projectRootDir, {
      absolute: true,
    });
    const isNodeModule = id.includes("node_modules");
    const hadFile = files.has(id);

    files.add(resolvedId);

    if (devServer && isNodeModule) {
      const lookupModule =
        kind === "client"
          ? "virtual:use-client-lookup"
          : "virtual:use-server-lookup";

      log(
        "Registering missing import for %s module resolvedId=%s in environment %s, fullPath=%s",
        kind,
        resolvedId,
        environment,
        fullPath,
      );
      devServer.environments[environment].depsOptimizer?.registerMissingImport(
        resolvedId,
        fullPath,
      );

      if (isAfterFirstResponse && !hadFile) {
        log(
          "Invalidating cache for lookup module %s after adding module id=%s",
          lookupModule,
          id,
        );
      }
    }
  };

  const addClientModule = (environment: string, id: string) => {
    addModule("client", environment, id);
  };

  const addServerModule = (environment: string, id: string) => {
    addModule("server", environment, id);
  };

  return {
    name: "rwsdk:rsc-directives",
    configureServer(server) {
      devServer = server;
      devServer.middlewares.use((_req, res, next) => {
        // context(justinvdm, 15 Jun 2025): We want to watch for new client and server modules
        // and invalidate their respective module lookups when this happens, but
        // we only want to do this after the first render
        if (!isAfterFirstResponse) {
          res.on("finish", () => {
            if (!isAfterFirstResponse) {
              isAfterFirstResponse = true;
              log("Dev server first response completed");
            }
          });
        }
        next();
      });
    },
    async transform(code, id) {
      const normalizedId = normalizeModulePath(id, projectRootDir);

      const clientResult = await transformClientComponents(code, normalizedId, {
        environmentName: this.environment.name,
        clientFiles,
        addClientModule,
      });

      if (clientResult) {
        process.env.VERBOSE &&
          log("Client component transformation successful for id=%s", id);
        return {
          code: clientResult.code,
          map: clientResult.map,
        };
      }

      const serverResult = transformServerFunctions(
        code,
        normalizedId,
        this.environment.name as "client" | "worker" | "ssr",
        serverFiles,
        addServerModule,
      );

      if (serverResult) {
        process.env.VERBOSE &&
          log("Server function transformation successful for id=%s", id);
        return {
          code: serverResult.code,
          map: serverResult.map,
        };
      }

      // Removed: too noisy even in verbose mode
    },
    configEnvironment(env, config) {
      process.env.VERBOSE && log("Configuring environment: env=%s", env);
      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];

      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "rsc-directives-esbuild-transform",
        setup(build) {
          log("Setting up esbuild plugin for environment: %s", env);
          build.onLoad(
            { filter: /\.(js|ts|jsx|tsx|mts|mjs|cjs)$/ },
            async (args) => {
              process.env.VERBOSE &&
                log(
                  "Esbuild onLoad called for environment=%s, path=%s",
                  env,
                  args.path,
                );

              const normalizedPath = normalizeModulePath(
                args.path,
                projectRootDir,
              );

              // context(justinvdm,2025-06-15): If we're in app code,
              // we will be doing the transform work in the vite plugin hooks,
              // the only reason we're in esbuild land for app code is for
              // dependency discovery, so we can skip transform work
              // and use heuristics instead - see below inside if block
              if (!args.path.includes("node_modules")) {
                log("Esbuild onLoad found app code, path=%s", args.path);

                if (clientFiles.has(normalizedPath)) {
                  // context(justinvdm,2025-06-15): If this is a client file:
                  // * for ssr and client envs we can skip so esbuild looks at the
                  // original source code to discovery dependencies
                  // * for worker env, the transform would have just created
                  // references and dropped all imports, so we can just return empty code
                  if (env === "client" || env === "ssr") {
                    log(
                      "Esbuild onLoad skipping client module in app code for client or ssr env, path=%s",
                      args.path,
                    );
                    return undefined;
                  } else {
                    log(
                      "Esbuild onLoad returning empty code for server module in app code for worker env, path=%s to bypass esbuild dependency discovery",
                      args.path,
                    );
                    return {
                      contents: "",
                      loader: "js",
                    };
                  }
                } else if (serverFiles.has(normalizedPath)) {
                  // context(justinvdm,2025-06-15): If this is a server file:
                  // * for worker env, we can skip so esbuild looks at the
                  // original source code to discovery dependencies
                  // * for ssr and client envs, the transform would have just created
                  // references and dropped all imports, so we can just return empty code
                  if (env === "worker") {
                    log(
                      "Esbuild onLoad skipping server module in app code for worker env, path=%s",
                      args.path,
                    );
                    return undefined;
                  } else if (env === "ssr" || env === "client") {
                    log(
                      "Esbuild onLoad returning empty code for server module in app code for ssr or client env, path=%s",
                      args.path,
                    );
                    return {
                      contents: "",
                      loader: "js",
                    };
                  }
                }
              }

              let code: string;

              try {
                code = await fs.readFile(args.path, "utf-8");
              } catch {
                process.env.VERBOSE &&
                  log(
                    "Failed to read file: %s, environment=%s",
                    args.path,
                    env,
                  );
                return undefined;
              }

              const clientResult = await transformClientComponents(
                code,
                normalizedPath,
                {
                  environmentName: env,
                  clientFiles,
                  isEsbuild: true,
                  addClientModule,
                },
              );

              if (clientResult) {
                process.env.VERBOSE &&
                  log(
                    "Esbuild client component transformation successful for environment=%s, path=%s",
                    env,
                    args.path,
                  );
                process.env.VERBOSE &&
                  log(
                    "Esbuild client component transformation for environment=%s, path=%s, code: %j",
                    env,
                    args.path,
                    clientResult.code,
                  );
                return {
                  contents: clientResult.code,
                  loader: getLoader(args.path),
                };
              }

              const serverResult = transformServerFunctions(
                code,
                normalizedPath,
                env as "client" | "worker" | "ssr",
                serverFiles,
                addServerModule,
              );

              if (serverResult) {
                process.env.VERBOSE &&
                  log(
                    "Esbuild server function transformation successful for environment=%s, path=%s",
                    env,
                    args.path,
                  );
                return {
                  contents: serverResult.code,
                  loader: getLoader(args.path),
                };
              }

              process.env.VERBOSE &&
                log(
                  "Esbuild no transformation applied for environment=%s, path=%s",
                  env,
                  args.path,
                );
            },
          );
        },
      });
      process.env.VERBOSE &&
        log("Environment configuration complete for env=%s", env);
    },
  };
};
