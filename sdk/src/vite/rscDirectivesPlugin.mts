import { Plugin } from "vite";
import debug from "debug";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { transformServerFunctions } from "./transformServerFunctions.mjs";
import { normalizeModulePath } from "./normalizeModulePath.mjs";

const log = debug("rwsdk:vite:rsc-directives-plugin");
const verboseLog = debug("verbose:rwsdk:vite:rsc-directives-plugin");

export const rscDirectivesPlugin = ({
  projectRootDir,
  clientFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
}): Plugin => ({
  name: "rwsdk:rsc-directives",
  async transform(code, id) {
    verboseLog(
      "Transform called for id=%s, environment=%s",
      id,
      this.environment.name,
    );

    const clientResult = await transformClientComponents(code, id, {
      environmentName: this.environment.name,
      clientFiles,
      projectRootDir,
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
      normalizeModulePath(projectRootDir, id),
      this.environment.name as "client" | "worker",
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
        build.onLoad({ filter: /.*\.js$/ }, async (args) => {
          verboseLog("Esbuild onLoad called for path=%s", args.path);

          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          let code: string;

          try {
            code = await fs.readFile(args.path, "utf-8");
          } catch {
            verboseLog("Failed to read file: %s", args.path);
            return undefined;
          }

          const clientResult = await transformClientComponents(
            code,
            args.path,
            {
              environmentName: env,
              clientFiles,
              isEsbuild: true,
              projectRootDir,
            },
          );

          if (clientResult) {
            log(
              "Esbuild client component transformation successful for path=%s",
              args.path,
            );
            return {
              contents: clientResult.code,
              loader: path.extname(args.path).slice(1) as any,
            };
          }

          const serverResult = transformServerFunctions(
            code,
            normalizeModulePath(projectRootDir, args.path),
            env as "client" | "worker",
          );

          if (serverResult) {
            log(
              "Esbuild server function transformation successful for path=%s",
              args.path,
            );
            return {
              contents: serverResult.code,
              loader: path.extname(args.path).slice(1) as any,
            };
          }

          verboseLog(
            "Esbuild no transformation applied for path=%s",
            args.path,
          );
        });
      },
    });
    log("Environment configuration complete for env=%s", env);
  },
});
