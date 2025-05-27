import { relative } from "node:path";
import { Plugin } from "vite";
import { transformClientComponents } from "./transformClientComponents.mjs";
import { transformServerFunctions } from "./transformServerFunctions.mjs";

export const rscDirectivesPlugin = ({
  clientFiles,
}: {
  clientFiles: Set<string>;
}): Plugin => ({
  name: "rwsdk:rsc-directives",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const clientResult = await transformClientComponents(code, id, {
      environmentName: this.environment.name,
      clientFiles,
    });

    if (clientResult) {
      return {
        code: clientResult.toString(),
        map: clientResult.generateMap({ hires: true }),
      };
    }

    if (code.indexOf("use server") === -1) {
      return;
    }

    const serverResult = transformServerFunctions(
      code,
      `/${relative(this.environment.getTopLevelConfig().root, id)}`,
      this.environment.name as "client" | "worker",
    );

    if (serverResult) {
      return {
        code: serverResult,
      };
    }
  },
  configEnvironment(env, config) {
    config.optimizeDeps ??= {};
    config.optimizeDeps.esbuildOptions ??= {};
    config.optimizeDeps.esbuildOptions.plugins ??= [];

    config.optimizeDeps.esbuildOptions.plugins.push({
      name: "rsc-directives-esbuild-transform",
      setup(build) {
        build.onLoad({ filter: /.*/ }, async (args) => {
          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          let code: string;

          try {
            code = await fs.readFile(args.path, "utf-8");
          } catch {
            return;
          }

          const clientResult = await transformClientComponents(
            code,
            args.path,
            {
              environmentName: env,
              clientFiles,
              isEsbuild: true,
            },
          );

          if (clientResult) {
            return {
              contents: clientResult.toString(),
              loader: path.extname(args.path).slice(1) as any,
            };
          }

          if (code.indexOf("use server") === -1) {
            return;
          }

          const serverResult = transformServerFunctions(
            code,
            `/${relative(process.cwd(), args.path)}`,
            env as "client" | "worker",
          );

          if (serverResult) {
            return {
              contents: serverResult,
              loader: path.extname(args.path).slice(1) as any,
            };
          }
        });
      },
    });
  },
});
