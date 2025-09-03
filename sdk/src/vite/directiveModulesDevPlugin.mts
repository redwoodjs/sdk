import path from "node:path";
import { Environment, Plugin } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";
import { CLIENT_BARREL_PATH } from "../lib/constants.mjs";
import { SERVER_BARREL_PATH } from "../lib/constants.mjs";

export const VIRTUAL_CLIENT_BARREL_ID = "virtual:rwsdk:client-module-barrel";
export const VIRTUAL_SERVER_BARREL_ID = "virtual:rwsdk:server-module-barrel";

const CLIENT_BARREL_EXPORT_PATH = "rwsdk/__client_barrel";
const SERVER_BARREL_EXPORT_PATH = "rwsdk/__server_barrel";

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
      .map(
        (file, i) => `  '${normalizeModulePath(file, projectRootDir)}': M${i},`,
      )
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
    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      for (const [envName, env] of Object.entries(config.environments)) {
        if (envName === "client" || envName === "ssr") {
          env.optimizeDeps.include = [
            ...(env.optimizeDeps.include || []),
            CLIENT_BARREL_EXPORT_PATH,
            SERVER_BARREL_EXPORT_PATH,
          ];
        }
      }
    },

    configureServer(server) {
      // context(justinvdm, 3 Sep 2025): This is a workaround for a timing issue
      // in Vite's startup process. We need to run our directive scan after
      // the environments are fully initialized but before the dependency
      // optimizer starts. No public hook exists for this, so we wrap the
      // internal _initEnvironments method to inject our logic at the right time.
      // See the full explanation in the work log:
      // .worklogs/justin/2025-09-03-directive-scan-timing-in-dev.md
      const originalInit = (server as any)._initEnvironments;

      (server as any)._initEnvironments = async () => {
        await originalInit.call(server);

        const workerEnv = server.config.environments[
          "worker"
        ] as unknown as Environment;

        if (workerEnv) {
          await runDirectivesScan({
            rootConfig: server.config,
            environment: workerEnv,
            clientFiles,
            serverFiles,
          });
        }

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

        mkdirSync(path.dirname(CLIENT_BARREL_PATH), { recursive: true });
        writeFileSync(CLIENT_BARREL_PATH, clientBarrelContent);

        mkdirSync(path.dirname(SERVER_BARREL_PATH), { recursive: true });
        writeFileSync(SERVER_BARREL_PATH, serverBarrelContent);
      };
    },
  };
};
