import path from "path";
import { Plugin } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

const CLIENT_BARREL_EXPORT_PATH = "rwsdk/__client_barrel";
const SERVER_BARREL_EXPORT_PATH = "rwsdk/__server_barrel";

const APP_CLIENT_BARREL_VIRTUAL_ID = "virtual:rwsdk:app-client-barrel";
const APP_SERVER_BARREL_VIRTUAL_ID = "virtual:rwsdk:app-server-barrel";
const VIRTUAL_BARREL_NAMESPACE = "rwsdk-virtual-barrel";

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

const generateAppBarrelContent = (
  files: Set<string>,
  projectRootDir: string,
) => {
  return [...files]
    .filter((file) => !file.includes("node_modules"))
    .map((file) => {
      const relativePath = path.relative(projectRootDir, file);
      const posixPath = relativePath.split(path.sep).join(path.posix.sep);
      return `import './${posixPath}';`;
    })
    .join("\n");
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
  const { promise: scanPromise, resolve: resolveScanPromise } =
    Promise.withResolvers<void>();

  return {
    name: "rwsdk:directive-modules-dev",

    resolveId(id) {
      if (
        id === APP_CLIENT_BARREL_VIRTUAL_ID ||
        id === APP_SERVER_BARREL_VIRTUAL_ID
      ) {
        return `\0${id}`;
      }
      return null;
    },

    async load(id) {
      if (id === `\0${APP_CLIENT_BARREL_VIRTUAL_ID}`) {
        await scanPromise;
        return generateAppBarrelContent(clientFiles, projectRootDir);
      }
      if (id === `\0${APP_SERVER_BARREL_VIRTUAL_ID}`) {
        await scanPromise;
        return generateAppBarrelContent(serverFiles, projectRootDir);
      }
      return null;
    },

    configureServer(server) {
      if (!process.env.VITE_IS_DEV_SERVER || process.env.RWSDK_WORKER_RUN) {
        resolveScanPromise();
        return;
      }

      runDirectivesScan({
        rootConfig: server.config,
        environments: server.environments,
        clientFiles,
        serverFiles,
      }).then(() => {
        // After the scan is complete, write the dependency barrel files.
        const clientBarrelContent = generateBarrelContent(
          clientFiles,
          projectRootDir,
        );
        writeFileSync(CLIENT_BARREL_PATH, clientBarrelContent);

        const serverBarrelContent = generateBarrelContent(
          serverFiles,
          projectRootDir,
        );
        writeFileSync(SERVER_BARREL_PATH, serverBarrelContent);
        resolveScanPromise();
      });

      server.middlewares.use(async (_req, _res, next) => {
        await scanPromise;
        next();
      });
    },

    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      // Create dummy files for the dependency barrels.
      mkdirSync(path.dirname(CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(SERVER_BARREL_PATH, "");

      for (const [envName, env] of Object.entries(config.environments || {})) {
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        env.optimizeDeps.entries ??= [];
        const entries = (env.optimizeDeps.entries = castArray(
          env.optimizeDeps.entries ?? [],
        ));
        env.optimizeDeps.include.push(
          CLIENT_BARREL_EXPORT_PATH,
          SERVER_BARREL_EXPORT_PATH,
        );

        if (envName === "client") {
          entries.push(APP_CLIENT_BARREL_VIRTUAL_ID);
        } else if (envName === "worker") {
          entries.push(APP_SERVER_BARREL_VIRTUAL_ID);
        }
      }
    },
  };
};

const castArray = <T,>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};
