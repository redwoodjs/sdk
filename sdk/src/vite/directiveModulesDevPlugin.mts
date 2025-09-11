import path from "path";
import { Plugin } from "vite";
import { writeFileSync, mkdirSync, promises as fs } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

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

const generateAppBarrelContent = (
  files: Set<string>,
  projectRootDir: string,
  barrelFilePath: string,
) => {
  return [...files]
    .filter((file) => !file.includes("node_modules"))
    .map((file) => {
      const resolvedPath = normalizeModulePath(file, projectRootDir, {
        absolute: true,
      });
      return `import "${resolvedPath}";`;
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

  const tempDir = path.join(projectRootDir, ".rwsdk", "temp");
  const APP_CLIENT_BARREL_PATH = path.join(tempDir, "app-client-barrel.js");
  const APP_SERVER_BARREL_PATH = path.join(tempDir, "app-server-barrel.js");

  return {
    name: "rwsdk:directive-modules-dev",

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
        mkdirSync(path.dirname(CLIENT_BARREL_PATH), { recursive: true });
        const clientBarrelContent = generateBarrelContent(
          clientFiles,
          projectRootDir,
        );
        writeFileSync(CLIENT_BARREL_PATH, clientBarrelContent);

        mkdirSync(path.dirname(SERVER_BARREL_PATH), { recursive: true });
        const serverBarrelContent = generateBarrelContent(
          serverFiles,
          projectRootDir,
        );
        writeFileSync(SERVER_BARREL_PATH, serverBarrelContent);

        // And the application barrel files
        const appClientBarrelContent = generateAppBarrelContent(
          clientFiles,
          projectRootDir,
          APP_CLIENT_BARREL_PATH,
        );
        writeFileSync(APP_CLIENT_BARREL_PATH, appClientBarrelContent);

        const appServerBarrelContent = generateAppBarrelContent(
          serverFiles,
          projectRootDir,
          APP_SERVER_BARREL_PATH,
        );
        writeFileSync(APP_SERVER_BARREL_PATH, appServerBarrelContent);

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

      // And for the application barrels
      mkdirSync(path.dirname(APP_CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(APP_CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(APP_SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(APP_SERVER_BARREL_PATH, "");

      for (const [envName, env] of Object.entries(config.environments || {})) {
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        const entries = (env.optimizeDeps.entries = castArray(
          env.optimizeDeps.entries ?? [],
        ));
        env.optimizeDeps.include.push(
          CLIENT_BARREL_EXPORT_PATH,
          SERVER_BARREL_EXPORT_PATH,
        );

        if (envName === "client") {
          entries.push(APP_CLIENT_BARREL_PATH);
        } else if (envName === "worker") {
          entries.push(APP_SERVER_BARREL_PATH);
        }

        env.optimizeDeps.esbuildOptions ??= {};
        env.optimizeDeps.esbuildOptions.plugins ??= [];
        env.optimizeDeps.esbuildOptions.plugins.unshift({
          name: "rwsdk:app-barrel-blocker",
          setup(build) {
            const barrelPaths = [
              APP_CLIENT_BARREL_PATH,
              APP_SERVER_BARREL_PATH,
            ];
            const filter = new RegExp(
              `(${barrelPaths.map((p) => p.replace(/\\/g, "\\\\")).join("|")})$`,
            );

            build.onResolve({ filter: /.*/ }, async (args: any) => {
              console.log(`##### esbuild:onResolve [${envName}]`, args.path);
              if (filter.test(args.path)) {
                console.log(
                  `[rwsdk:blocker] resolving [${envName}] ${args.path}`,
                );
                await scanPromise;
                console.log(
                  `[rwsdk:blocker] scan complete for ${args.path}, proceeding.`,
                );
                return {
                  path: args.path,
                  namespace: "rwsdk-app-barrel-ns",
                };
              }
            });

            build.onLoad({ filter: /.*/ }, async (args) => {
              console.log(
                `[rwsdk:loader] seeing ${args.path} (namespace: ${args.namespace})`,
              );
              if (args.namespace === "rwsdk-app-barrel-ns") {
                console.log(`[rwsdk:loader] loading content for ${args.path}`);
                const content = await fs.readFile(args.path, "utf-8");
                console.log(
                  `[rwsdk:loader] content for ${args.path}:\n---\n${content}\n---`,
                );
                return {
                  contents: content,
                  loader: "js",
                };
              }
            });
          },
        });
      }
    },
  };
};

const castArray = <T,>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};
