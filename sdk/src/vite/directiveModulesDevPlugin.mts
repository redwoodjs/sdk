import { Plugin } from "vite";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { runEsbuildScan } from "./runEsbuildScan.mjs";
import { getViteEsbuild } from "./getViteEsbuild.mjs";

export const VIRTUAL_CLIENT_BARREL_ID = "virtual:rwsdk:client-module-barrel";
export const VIRTUAL_SERVER_BARREL_ID = "virtual:rwsdk:server-module-barrel";

const generateBarrelContent = (files: Set<string>, projectRootDir: string) => {
  const imports = [...files]
    .filter((file) => file.includes("node_modules"))
    .map(
      (file, i) =>
        `import * as M${i} from '${normalizeModulePath(file, projectRootDir, {
          absolute: true,
        })}';`,
    )
    .join("\n");

  const exports =
    "export default {\n" +
    [...files]
      .filter((file) => file.includes("node_modules"))
      .map((file, i) => `  '${file}': M${i},`)
      .join("\n") +
    "\n};";

  return `${imports}\n\n${exports}`;
};

export const directiveModulesDevPlugin = ({
  clientFiles,
  serverFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:directive-modules-dev",
    enforce: "pre",
    async configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      // Phase 1: Standalone esbuild scan to discover all directive files
      const workerEnv = config.environments["worker"];
      if (workerEnv) {
        await runEsbuildScan({
          rootConfig: config,
          envName: "worker",
          clientFiles,
          serverFiles,
        });
      }

      // Phase 2: Barrel Generation for Vite's optimizer
      const dummyFilePaths = {
        client: path.join(
          projectRootDir,
          "node_modules",
          ".vite",
          "rwsdk-client-barrel.js",
        ),
        server: path.join(
          projectRootDir,
          "node_modules",
          ".vite",
          "rwsdk-server-barrel.js",
        ),
      };

      // Generate the barrel content and write it to the dummy files.
      // We can do this now because our scan is complete.
      const clientBarrelContent = generateBarrelContent(
        clientFiles,
        projectRootDir,
      );
      const serverBarrelContent = generateBarrelContent(
        serverFiles,
        projectRootDir,
      );

      mkdirSync(path.dirname(dummyFilePaths.client), { recursive: true });
      writeFileSync(dummyFilePaths.client, clientBarrelContent);

      mkdirSync(path.dirname(dummyFilePaths.server), { recursive: true });
      writeFileSync(dummyFilePaths.server, serverBarrelContent);

      for (const [envName, env] of Object.entries(config.environments)) {
        if (envName === "client" || envName === "ssr") {
          env.optimizeDeps.include = [
            ...(env.optimizeDeps.include || []),
            dummyFilePaths.client,
            dummyFilePaths.server,
          ];
        }
      }
    },
  };
};
