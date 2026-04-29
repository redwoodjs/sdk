import debug from "debug";
import fs from "node:fs/promises";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { Plugin } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { addOptimizeDepsPlugin } from "./addOptimizeDepsPlugin.mjs";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { transformServerFunctions } from "./transformServerFunctions.mjs";

const log = debug("rwsdk:vite:rsc-directives-plugin");

export const getLoader = (filePath: string) => {
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
  let isBuild = false;

  return {
    name: "rwsdk:rsc-directives",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    configureServer(server) {
      // context(justinvdm, 19 Nov 2025): This hook adds a middleware to track
      // when the first server response has finished. Unlike plugins that must
      // run before the Cloudflare plugin to prevent startup deadlocks, its
      // execution order is not critical, so `enforce: 'pre'` is not needed.
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
      if (
        isBuild &&
        this.environment?.name === "worker" &&
        process.env.RWSDK_BUILD_PASS !== "worker"
      ) {
        return;
      }
      const normalizedId = normalizeModulePath(id, projectRootDir);

      const clientResult = await transformClientComponents(code, normalizedId, {
        environmentName: this.environment.name,
        clientFiles,
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
      if (
        isBuild &&
        env === "worker" &&
        process.env.RWSDK_BUILD_PASS !== "worker"
      ) {
        return;
      }
      process.env.VERBOSE && log("Configuring environment: env=%s", env);

      const directivesFileFilter = /\.(js|ts|jsx|tsx|mts|mjs|cjs)$/;

      async function handleDirectivesLoad(filePath: string) {
        const normalizedPath = normalizeModulePath(filePath, projectRootDir);

        if (!filePath.includes("node_modules")) {
          if (clientFiles.has(normalizedPath)) {
            if (env === "client" || env === "ssr") {
              return undefined;
            } else {
              return { code: "", moduleType: "js" as const };
            }
          } else if (serverFiles.has(normalizedPath)) {
            if (env === "worker") {
              return undefined;
            } else if (env === "ssr" || env === "client") {
              return { code: "", moduleType: "js" as const };
            }
          }
        }

        let code: string;
        try {
          code = await fs.readFile(filePath, "utf-8");
        } catch {
          return undefined;
        }

        const clientResult = await transformClientComponents(
          code,
          normalizedPath,
          { environmentName: env, clientFiles, isEsbuild: true },
        );
        if (clientResult) {
          return { code: clientResult.code, moduleType: getLoader(filePath) };
        }

        const serverResult = transformServerFunctions(
          code,
          normalizedPath,
          env as "client" | "worker" | "ssr",
          serverFiles,
        );
        if (serverResult) {
          return { code: serverResult.code, moduleType: getLoader(filePath) };
        }

        return undefined;
      }

      addOptimizeDepsPlugin(config, {
        name: "rsc-directives-transform",
        async load(id: string) {
          if (!directivesFileFilter.test(id)) {
            return;
          }
          const result = await handleDirectivesLoad(id);
          if (result) {
            return { code: result.code, moduleType: result.moduleType };
          }
        },
      });
    },
  };
};
