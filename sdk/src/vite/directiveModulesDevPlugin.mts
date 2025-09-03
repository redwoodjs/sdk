import path from "node:path";
import { Plugin, DevEnvironment } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

// Awaiting this promise will ensure that the worker environment's directive
// scan is complete.
let workerScanComplete: Promise<void>;

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
  const esbuildBlockingPlugin = {
    name: "rwsdk:esbuild-barrel-blocker",
    setup(build: any) {
      const barrelFilter = new RegExp(
        `(${CLIENT_BARREL_PATH}|${SERVER_BARREL_PATH})`,
      );
      build.onResolve({ filter: barrelFilter }, async (args: any) => {
        await workerScanComplete;
        // After awaiting, we generate the barrel files with the now-populated
        // clientFiles and serverFiles sets.
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
        return args;
      });
    },
  };

  return {
    name: "rwsdk:directive-modules-dev",
    config(config, { command }) {
      if (command !== "serve") {
        return;
      }

      // --- Orchestration Logic (must run early) ---
      const workerEnvOptions = config.environments?.["worker"]?.dev;
      if (workerEnvOptions?.createEnvironment) {
        // context(justinvdm, 3 Sep 2025): This is a workaround for a timing
        // issue in Vite's startup process. We need to run our directive scan
        // after the worker environment is fully initialized but before the
        // client/ssr dependency optimizers start. No public hook exists for
        // this, so we must patch the environment creation and init process.
        // See the full explanation in the work log:
        // .worklogs/justin/2025-09-03-directive-scan-timing-in-dev.md
        const originalCreate = workerEnvOptions.createEnvironment;
        workerEnvOptions.createEnvironment = async (...args) => {
          const environment = await originalCreate.call(
            workerEnvOptions,
            ...args,
          );
          const originalInit = environment.init;
          let resolveWorkerScanComplete: () => void;
          workerScanComplete = new Promise((resolve) => {
            resolveWorkerScanComplete = resolve;
          });

          environment.init = async (...initArgs) => {
            await originalInit.apply(environment, initArgs);
            await runDirectivesScan({
              rootConfig: environment.config,
              environment: environment as unknown as DevEnvironment,
              clientFiles,
              serverFiles,
            });
            resolveWorkerScanComplete();
          };
          return environment;
        };
      }
    },
    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      // --- Synchronization Logic (must run on resolved config) ---
      for (const [envName, env] of Object.entries(config.environments || {})) {
        if (envName === "client" || envName === "ssr") {
          env.optimizeDeps.include = [
            ...(env.optimizeDeps.include || []),
            CLIENT_BARREL_EXPORT_PATH,
            SERVER_BARREL_EXPORT_PATH,
          ];
          env.optimizeDeps.esbuildOptions ??= {};
          env.optimizeDeps.esbuildOptions.plugins = [
            ...(env.optimizeDeps.esbuildOptions.plugins || []),
            esbuildBlockingPlugin,
          ];
        }
      }
    },
  };
};
