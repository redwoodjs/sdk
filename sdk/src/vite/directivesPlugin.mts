import { Plugin } from "vite";
import path from "node:path";
import fs from "node:fs/promises";
import debug from "debug";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { transformServerFunctions } from "./transformServerFunctions.mjs";
import { normalizeModulePath } from "./normalizeModulePath.mjs";

const log = debug("rwsdk:vite:rsc-directives-plugin");
const verboseLog = debug("verbose:rwsdk:vite:rsc-directives-plugin");

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
}): Plugin => ({
  name: "rwsdk:rsc-directives",
  async transform(code, id) {
    verboseLog(
      "Transform called for id=%s, environment=%s",
      id,
      this.environment.name,
    );

    const normalizedId = normalizeModulePath(projectRootDir, id);

    const clientResult = await transformClientComponents(code, normalizedId, {
      environmentName: this.environment.name,
      clientFiles,
    });

    if (clientResult) {
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
      log("Server function transformation successful for id=%s", id);
      return {
        code: serverResult.code,
        map: serverResult.map,
      };
    }

    verboseLog("No transformation applied for id=%s", id);
  },
  configEnvironment(env, config) {
    log("Configuring environment: env=%s", env);
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
            verboseLog("Esbuild onLoad called for path=%s", args.path);

            let code: string;

            try {
              code = await fs.readFile(args.path, "utf-8");
            } catch {
              verboseLog("Failed to read file: %s", args.path);
              return undefined;
            }

            const clientResult = await transformClientComponents(
              code,
              normalizeModulePath(projectRootDir, args.path),
              {
                environmentName: env,
                clientFiles,
                isEsbuild: true,
              },
            );

            if (clientResult) {
              log(
                "Esbuild client component transformation successful for path=%s",
                args.path,
              );
              return {
                contents: clientResult.code,
                loader: getLoader(args.path),
              };
            }

            const serverResult = transformServerFunctions(
              code,
              normalizeModulePath(projectRootDir, args.path),
              env as "client" | "worker" | "ssr",
              serverFiles,
            );

            if (serverResult) {
              log(
                "Esbuild server function transformation successful for path=%s",
                args.path,
              );
              return {
                contents: serverResult.code,
                loader: getLoader(args.path),
              };
            }

            verboseLog(
              "Esbuild no transformation applied for path=%s",
              args.path,
            );
          },
        );
      },
    });
    log("Environment configuration complete for env=%s", env);
  },
});
